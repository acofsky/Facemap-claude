import type { CandidateDraft } from './types';

/**
 * Normalize a display name for fuzzy matching:
 * Unicode NFD, strip diacritics, lowercase, collapse non-alphanumeric to space.
 * "José García-López" -> "jose garcia lopez".
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function lastDigits(phone: string | undefined, n = 7): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-n);
}

function emailLocal(email: string | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return null;
  return email.slice(0, at).toLowerCase();
}

/**
 * Returns a stable string used as the primary dedupe key. Two stubs that
 * collide on this key are considered the same person without further checks.
 *
 * - With phone: `<name> | p:<last7>`
 * - With email: `<name> | e:<local>`
 * - Neither:    `<name>` — these are vulnerable to false positives (common
 *               names) and should also pass the secondary fuzzy check.
 */
export function makeDedupeKey(input: { name: string; email?: string; phone?: string }): string {
  const n = normalizeName(input.name);
  const p = lastDigits(input.phone);
  if (p) return `${n} | p:${p}`;
  const e = emailLocal(input.email);
  if (e) return `${n} | e:${e}`;
  return n;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Last-line defense for name-only matches: small Levenshtein distance on
 * normalized names. Short names get a strict threshold — a single edit on
 * a 3-letter name covers "Bob" vs "Rob" which we obviously don't want.
 */
export function fuzzyNameMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = Math.min(na.length, nb.length);
  const limit = shorter <= 4 ? 0 : shorter <= 7 ? 1 : 2;
  return levenshtein(na, nb) <= limit;
}

/**
 * Collapse a batch of drafts so each unique person appears once. Strategy:
 *
 * 1. Group exact name-normalized matches first.
 * 2. Within a group, merge drafts unless their phones or emails actively
 *    conflict — same-name drafts with one filling in phone and another
 *    filling in email collapse to a single richer stub.
 * 3. Across groups, run a fuzzy pass on the name-only orphans (no phone
 *    AND no email) to catch typos across sources.
 */
export function mergeDrafts(drafts: CandidateDraft[]): CandidateDraft[] {
  const groups = new Map<string, CandidateDraft[]>();
  for (const d of drafts) {
    if (!d.name?.trim()) continue;
    const k = normalizeName(d.name);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }

  const clustered: CandidateDraft[] = [];
  for (const group of groups.values()) {
    const clusters: CandidateDraft[] = [];
    for (const d of group) {
      const idx = clusters.findIndex((c) => canMergeWithoutConflict(c, d));
      if (idx === -1) clusters.push(d);
      else clusters[idx] = mergePair(clusters[idx], d);
    }
    clustered.push(...clusters);
  }

  // Fuzzy pass — only for clusters with no phone AND no email, where the
  // dedupe key would just be the normalized name.
  const out: CandidateDraft[] = [];
  for (const c of clustered) {
    if (c.phone || c.email) { out.push(c); continue; }
    const idx = out.findIndex(
      (o) => !o.phone && !o.email && fuzzyNameMatch(o.name, c.name),
    );
    if (idx === -1) out.push(c);
    else out[idx] = mergePair(out[idx], c);
  }

  return out;
}

function canMergeWithoutConflict(a: CandidateDraft, b: CandidateDraft): boolean {
  const ap = lastDigits(a.phone);
  const bp = lastDigits(b.phone);
  if (ap && bp && ap !== bp) return false;
  const ae = emailLocal(a.email);
  const be = emailLocal(b.email);
  if (ae && be && ae !== be) return false;
  // Different photos on same-name candidates is a strong "different
  // people" signal — coincidental name+phone collisions happen, but
  // two different photo uploads pointing at the same person almost
  // never do. Refusing to merge prevents one candidate's photo from
  // accidentally landing on the other's promoted Person.
  if (a.photoPath && b.photoPath && a.photoPath !== b.photoPath) return false;
  return true;
}

function mergePair(a: CandidateDraft, b: CandidateDraft): CandidateDraft {
  const name = (b.name?.length || 0) > (a.name?.length || 0) ? b.name : a.name;
  return {
    source: a.source,
    name,
    email: a.email || b.email,
    phone: a.phone || b.phone,
    company: a.company || b.company,
    title: a.title || b.title,
    photoPath: a.photoPath || b.photoPath,
    context: [a.context, b.context].filter(Boolean).join(' · ') || undefined,
    raw: { ...(a.raw || {}), ...(b.raw || {}), merged_from: [a.source, b.source] },
  };
}

/**
 * Walk the existing People list and return a map from draft index → matched
 * person id. Drafts present in this map should NOT be promoted — surface
 * them in the UI as "Already in your People" and offer a merge instead.
 */
export function findMatchesAgainstPeople<P extends { id: string; name: string }>(
  drafts: CandidateDraft[],
  people: P[],
): Map<number, string> {
  const byKey = new Map<string, P>();
  for (const p of people) {
    byKey.set(makeDedupeKey({ name: p.name }), p);
  }
  const matches = new Map<number, string>();
  drafts.forEach((d, i) => {
    const direct = byKey.get(makeDedupeKey({ name: d.name }));
    if (direct) {
      matches.set(i, direct.id);
      return;
    }
    if (!d.phone && !d.email) {
      const fuzzy = people.find((p) => fuzzyNameMatch(p.name, d.name));
      if (fuzzy) matches.set(i, fuzzy.id);
    }
  });
  return matches;
}
