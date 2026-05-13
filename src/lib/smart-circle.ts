import type { Person } from '@/lib/store';

/**
 * Smart Circle Engine — runs entirely on-device against local data.
 * Detects clusters of recent person additions that probably came from
 * the same event/scene, generates a suggested Event name + member list.
 * No API calls.
 *
 * Founder decisions (Q7 + Q10): trigger on 2+ people added in 48h with
 * keyword overlap, OR 3+ added in 24h regardless.
 */

const STOP_WORDS = new Set([
  'the', 'at', 'a', 'an', 'and', 'in', 'on', 'of', 'to', 'for', 'with',
  'we', 'they', 'i', 'me', 'my', 'our', 'us', 'who', 'from', 'by', 'is',
  'was', 'were', 'are', 'be', 'been', 'or', 'but', 'this', 'that', 'it',
  'met', 'meeting', 'while', 'when', 'after', 'before',
]);

function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/** Stable signal terms for a person, drawn from how_we_met + where_when. */
export function personSignals(p: Person): string[] {
  return [...tokenize(p.how_we_met), ...tokenize(p.where_when)];
}

export interface SmartCluster {
  /** Stable fingerprint used to track dismissal. */
  fingerprint: string;
  suggestedName: string;
  /** Person IDs included in the cluster. */
  personIds: string[];
  /** Reason the engine triggered for this cluster (debug surface). */
  reason: 'keyword' | 'timing';
  /** Earliest creation date among members, for date pre-fill on the Event. */
  startDate: string | null;
  /** Latest creation date among members. */
  endDate: string | null;
}

const HOUR = 60 * 60 * 1000;

interface DetectOptions {
  /** Optional override for "now" — handy in tests. */
  now?: Date;
}

/**
 * Detection rules:
 *   A. keyword:  ≥2 people in the last 48h share at least one signal term
 *   B. timing :  ≥3 people added in the last 24h regardless of overlap
 *
 * Returns at most one cluster per matched signal — each cluster is a
 * candidate suggestion. Dismissal is handled separately via the hook
 * layer using the cluster fingerprint.
 */
export function detectClusters(people: Person[], opts: DetectOptions = {}): SmartCluster[] {
  const now = opts.now ?? new Date();
  const within48h = (p: Person) => now.getTime() - new Date(p.created_at).getTime() <= 48 * HOUR;
  const within24h = (p: Person) => now.getTime() - new Date(p.created_at).getTime() <= 24 * HOUR;

  const recent48 = people.filter(within48h);
  const recent24 = recent48.filter(within24h);
  const clusters: SmartCluster[] = [];

  // --- Rule A: keyword overlap across 2+ people in 48h ---
  const tokenIndex = new Map<string, Set<string>>(); // token -> set of person ids
  for (const p of recent48) {
    for (const t of new Set(personSignals(p))) {
      if (!tokenIndex.has(t)) tokenIndex.set(t, new Set());
      tokenIndex.get(t)!.add(p.id);
    }
  }
  // Group co-occurring tokens that share the SAME set of people. The token
  // group with the highest member count wins. Ties broken by frequency.
  const groupedByMemberSet = new Map<string, { tokens: string[]; ids: string[] }>();
  for (const [token, idsSet] of tokenIndex) {
    if (idsSet.size < 2) continue;
    const key = [...idsSet].sort().join(',');
    if (!groupedByMemberSet.has(key))
      groupedByMemberSet.set(key, { tokens: [], ids: [...idsSet].sort() });
    groupedByMemberSet.get(key)!.tokens.push(token);
  }
  const keywordCandidates = [...groupedByMemberSet.values()].sort(
    (a, b) => b.ids.length - a.ids.length || b.tokens.length - a.tokens.length,
  );
  for (const cand of keywordCandidates) {
    clusters.push(buildCluster(cand.ids, cand.tokens, 'keyword', people));
  }

  // --- Rule B: 3+ in 24h without keyword requirement ---
  if (recent24.length >= 3) {
    const ids = recent24.map((p) => p.id);
    // Only add if not already covered by a keyword cluster with the same set.
    const already = clusters.some((c) => sameSet(c.personIds, ids));
    if (!already) {
      // Borrow tokens for naming if any exist across the group, else fall back.
      const sharedTokens = mostCommonTokens(recent24);
      clusters.push(buildCluster(ids, sharedTokens, 'timing', people));
    }
  }

  return clusters;
}

function buildCluster(
  ids: string[],
  tokens: string[],
  reason: 'keyword' | 'timing',
  people: Person[],
): SmartCluster {
  const members = people.filter((p) => ids.includes(p.id));
  const dates = members.map((m) => m.created_at).sort();
  return {
    fingerprint: `${reason}:${ids.slice().sort().join(',')}`,
    suggestedName: suggestNameFromTokens(tokens, members),
    personIds: ids,
    reason,
    startDate: dates[0]?.slice(0, 10) ?? null,
    endDate: dates[dates.length - 1]?.slice(0, 10) ?? null,
  };
}

function suggestNameFromTokens(tokens: string[], members: Person[]): string {
  // Prefer the longest 1–3 word phrase found verbatim in the source fields.
  if (tokens.length === 0) {
    return 'New Event';
  }
  const sources = members.flatMap((m) => [m.how_we_met, m.where_when].filter(Boolean) as string[]);
  // Try every adjacent token pair / triple from sources, pick the longest that
  // contains ≥2 of our cluster tokens.
  const tokenSet = new Set(tokens);
  let best: string | null = null;
  for (const src of sources) {
    const words = src.split(/\s+/);
    for (let span = Math.min(4, words.length); span >= 1; span--) {
      for (let i = 0; i <= words.length - span; i++) {
        const slice = words.slice(i, i + span);
        const cleaned = slice
          .map((w) => w.replace(/[^\p{L}\p{N}\s]/gu, '').toLowerCase())
          .filter(Boolean);
        const hits = cleaned.filter((c) => tokenSet.has(c)).length;
        if (hits >= Math.min(2, tokens.length)) {
          const candidate = slice.join(' ').replace(/[,.!?]+$/, '').trim();
          if (candidate && (!best || candidate.length > best.length)) best = candidate;
        }
      }
    }
  }
  if (best) return titleCase(best);
  // Fallback: capitalize first cluster token.
  return titleCase(tokens[0]);
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function mostCommonTokens(people: Person[]): string[] {
  const counts = new Map<string, number>();
  for (const p of people) for (const t of new Set(personSignals(p))) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s = new Set(b);
  return a.every((x) => s.has(x));
}

/**
 * Surface 2 helper — given the partial inputs in the Add Person sheet,
 * see if they match any pending cluster's token vocabulary. Returns the
 * matching cluster (if any) so the inline strip can prompt to add to it.
 */
export function matchSheetInputToCluster(
  inputs: { how_we_met?: string | null; where_when?: string | null },
  clusters: SmartCluster[],
  people: Person[],
): SmartCluster | null {
  const tokens = new Set([...tokenize(inputs.how_we_met), ...tokenize(inputs.where_when)]);
  if (tokens.size === 0) return null;
  for (const c of clusters) {
    const clusterTokens = new Set(c.personIds.flatMap((id) => {
      const p = people.find((pp) => pp.id === id);
      return p ? personSignals(p) : [];
    }));
    let hits = 0;
    for (const t of tokens) if (clusterTokens.has(t)) hits++;
    if (hits >= 1) return c;
  }
  return null;
}
