import type { Person } from '@/lib/store';

/**
 * Smart Circle Engine — runs entirely on-device against local data.
 * Detects clusters of recent person additions that probably came from
 * the same event/scene, generates a suggested Event name + member list.
 * No API calls.
 *
 * Trigger rules (tuned post-launch — adding 2 in 48h was firing too
 * eagerly, especially when one of the two was older and the user was
 * just topping up a single new add):
 *   A. keyword:  ≥3 people in the last 48h share at least one signal term
 *   B. timing :  ≥4 people added in the last 24h that ALSO share at least
 *                one signal term across ≥2 of them. The shared term is both
 *                what we name the Event after and the evidence it's a real
 *                scene — without it, a contextless burst of adds (most often
 *                a Smart Import of unrelated contacts, whose facts live in
 *                Background/About, not how-we-met) would surface a
 *                meaningless "New Event" the engine can't even name.
 *
 * Suggestions are de-duplicated against existing Events AND Circles
 * via fuzzy name matching at the hook layer (see use-smart-clusters),
 * so the engine never proposes a circle the user already has.
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
  /** Tokens we picked up from members — exposed so the hook layer can
   *  fuzzy-match against existing Event / Circle names without re-doing
   *  the personSignals work. */
  tokens: string[];
}

const HOUR = 60 * 60 * 1000;

/** Minimum people in the 48h window sharing a keyword token to trigger
 *  a keyword cluster. */
const MIN_KEYWORD_MEMBERS = 3;
/** Minimum people in the 24h window to trigger a pure timing cluster
 *  (no keyword overlap required). */
const MIN_TIMING_MEMBERS = 4;

interface DetectOptions {
  /** Optional override for "now" — handy in tests. */
  now?: Date;
}

export function detectClusters(people: Person[], opts: DetectOptions = {}): SmartCluster[] {
  const now = opts.now ?? new Date();
  const within48h = (p: Person) => now.getTime() - new Date(p.created_at).getTime() <= 48 * HOUR;
  const within24h = (p: Person) => now.getTime() - new Date(p.created_at).getTime() <= 24 * HOUR;

  const recent48 = people.filter(within48h);
  const recent24 = recent48.filter(within24h);
  const clusters: SmartCluster[] = [];

  // --- Rule A: keyword overlap across ≥MIN_KEYWORD_MEMBERS people in 48h ---
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
    if (idsSet.size < MIN_KEYWORD_MEMBERS) continue;
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

  // --- Rule B: ≥MIN_TIMING_MEMBERS in 24h, but only when ≥2 of them share a
  // signal term — that term names the Event and proves it's a real scene
  // rather than a contextless burst (e.g. a Smart Import). ---
  if (recent24.length >= MIN_TIMING_MEMBERS) {
    const sharedTokens = tokensSharedByAtLeast(recent24, 2);
    if (sharedTokens.length > 0) {
      const ids = recent24.map((p) => p.id);
      // Only add if not already covered by a keyword cluster with the same set.
      const already = clusters.some((c) => sameSet(c.personIds, ids));
      if (!already) clusters.push(buildCluster(ids, sharedTokens, 'timing', people));
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
    tokens,
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

/** Signal terms appearing in at least `minPeople` of the group, most-common
 *  first. Used to both gate and name a timing cluster. */
function tokensSharedByAtLeast(people: Person[], minPeople: number): string[] {
  const counts = new Map<string, number>();
  for (const p of people) for (const t of new Set(personSignals(p))) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c >= minPeople)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
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

/**
 * Surface 3 helper — given an Event name and the full people list, find
 * up to N members who probably belong based on overlapping tokens in their
 * how_we_met / where_when fields. Excludes anyone already in the event.
 */
export function suggestEventMembers(
  eventName: string,
  people: Person[],
  currentMemberIds: string[],
  limit = 4,
): Person[] {
  const nameTokens = new Set(tokenize(eventName));
  if (nameTokens.size === 0) return [];
  const memberSet = new Set(currentMemberIds);
  const scored: { p: Person; score: number }[] = [];
  for (const p of people) {
    if (memberSet.has(p.id)) continue;
    const tokens = personSignals(p);
    let score = 0;
    for (const t of tokens) if (nameTokens.has(t)) score++;
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((x) => x.p);
}

/**
 * Fuzzy name match for de-duplicating Smart Circle suggestions against
 * existing Events / Circles. Returns true when two names probably refer
 * to the same thing despite different wording.
 *
 * Matches when:
 *   - normalized strings are equal, or
 *   - one normalized string is a substring of the other (≥3 chars), or
 *   - their content tokens (length ≥3, stop-words stripped) overlap by
 *     at least 50% of the shorter set's size.
 *
 * Examples that match: "Stanford Mixer" vs "Stanford alumni",
 * "Booth MBA" vs "Booth", "Tribeca Rooftop dinner" vs "Tribeca dinner".
 */
export function namesProbablyMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  const at = new Set(tokenize(a));
  const bt = new Set(tokenize(b));
  if (at.size === 0 || bt.size === 0) return false;
  let overlap = 0;
  for (const t of at) if (bt.has(t)) overlap++;
  const shorter = Math.min(at.size, bt.size);
  return overlap >= Math.max(1, Math.ceil(shorter * 0.5));
}

/**
 * True when the cluster's suggested name or any of its source tokens
 * obviously overlaps with an existing Event / Circle name — used to
 * suppress the banner so we don't pitch the user a circle they already
 * have. Tokens are checked in addition to the suggested name so a poor
 * naming heuristic doesn't bypass the dedupe.
 */
export function clusterDuplicatesExisting(
  cluster: SmartCluster,
  existingNames: string[],
): boolean {
  for (const name of existingNames) {
    if (!name) continue;
    if (namesProbablyMatch(cluster.suggestedName, name)) return true;
    // Also dedupe by raw token: if a cluster keyword token sits in an
    // existing name's tokens (e.g. cluster token "stanford" and existing
    // event "Stanford Mixer"), treat as a duplicate.
    const nameTokens = new Set(tokenize(name));
    if (cluster.tokens.some((t) => nameTokens.has(t))) return true;
  }
  return false;
}
