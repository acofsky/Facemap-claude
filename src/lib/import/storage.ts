import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { makeDedupeKey } from './dedupe';
import type { CandidateDraft, ImportCandidateRow, ImportSessionRow, ImportSource } from './types';

export async function createImportSession(input: {
  filterText: string;
  sources: ImportSource[];
}): Promise<ImportSessionRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('import_sessions')
    .insert({
      user_id: user.id,
      filter_text: input.filterText || null,
      sources: input.sources,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertCandidates(
  sessionId: string,
  drafts: CandidateDraft[],
): Promise<ImportCandidateRow[]> {
  if (drafts.length === 0) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const rows = drafts.map((d) => ({
    user_id: user.id,
    session_id: sessionId,
    source: d.source,
    name: d.name,
    email: d.email || null,
    phone: d.phone || null,
    company: d.company || null,
    title: d.title || null,
    photo_path: d.photoPath || null,
    dedupe_key: makeDedupeKey({ name: d.name, email: d.email, phone: d.phone }),
    raw: {
      ...(d.raw || {}),
      ...(d.mappedFields ? { mapped_fields: d.mappedFields } : {}),
      ...(d.context ? { context: d.context } : {}),
    } as Json,
  }));

  // Supabase has a soft cap on row count per insert. Chunk to stay safe.
  const CHUNK = 200;
  const out: ImportCandidateRow[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('import_candidates')
      .insert(rows.slice(i, i + CHUNK))
      .select();
    if (error) throw error;
    if (data) out.push(...data);
  }

  await supabase
    .from('import_sessions')
    .update({ candidates_count: out.length })
    .eq('id', sessionId);

  return out;
}

export async function updateCandidateRanking(
  candidateId: string,
  ranking: { score: number; rationale: string; bullets: string[] },
): Promise<void> {
  const { error } = await supabase
    .from('import_candidates')
    .update({
      ai_relevance_score: ranking.score,
      ai_rationale: ranking.rationale,
      ai_bullets: ranking.bullets as unknown as Json,
    })
    .eq('id', candidateId);
  if (error) throw error;
}

// PostgREST (Supabase) caps every GET at a server-side `max-rows` ceiling —
// 1000 by default. That ceiling is a hard upper bound: a client-side
// `.limit(5000)` is silently clamped back to 1000, so a single select can
// never return more than a page no matter what you ask for. The only way
// past it is to walk the result in `.range()` pages. A user with a large
// Contacts book (1k+) blows past one page easily; without paging the
// pending sheet, the wizard review, and the re-import dedup all silently
// truncate at 1000 — which is exactly what stranded ~470 of a 1.4k import.
const PAGE_SIZE = 1000;

/**
 * Walk a PostgREST query in PAGE_SIZE-row pages until a short page signals
 * the end, returning every row. `build` must apply `.range(from, to)` to a
 * fresh query each call. Always include a deterministic tiebreaker in the
 * query's ordering (e.g. a final `.order('id')`) so rows can't shuffle
 * between page requests and get skipped or double-counted at a boundary.
 */
async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

export async function fetchPendingCandidates(): Promise<ImportCandidateRow[]> {
  return fetchAllPaged<ImportCandidateRow>((from, to) =>
    supabase
      .from('import_candidates')
      .select('*')
      .eq('promoted', false)
      .eq('dismissed', false)
      .order('ai_relevance_score', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/**
 * Collect the iOS contact_ids that should be skipped on the next Read
 * Contacts pass — either a pending candidate OR a promoted candidate
 * whose linked Person row still exists. Orphan promoted candidates
 * (Person was deleted but the import_candidates row's promoted flag
 * was never cleared — common for data created before the deletePerson
 * cascade-cleanup landed) DO NOT count as known, so the contact can
 * be re-pulled fresh.
 *
 * Dismissed candidates are intentionally re-importable so a Clear All
 * doesn't lock anyone out forever.
 */
export async function fetchKnownContactIds(): Promise<Set<string>> {
  // Both sides paginate: a returning user can easily have 1k+ contact
  // candidates AND 1k+ People, so a single un-paged select on either would
  // hit the max-rows ceiling and wrongly treat the overflow as "unknown" —
  // re-importing already-imported contacts as duplicates.
  const [candRows, personRows] = await Promise.all([
    fetchAllPaged<{ raw: unknown; promoted: boolean; promoted_person_id: string | null }>((from, to) =>
      supabase
        .from('import_candidates')
        .select('raw, promoted, promoted_person_id')
        .eq('source', 'contacts')
        .eq('dismissed', false)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchAllPaged<{ id: string }>((from, to) =>
      supabase
        .from('persons')
        .select('id')
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  const livePersonIds = new Set(personRows.map((p) => p.id));
  const ids = new Set<string>();
  for (const row of candRows) {
    const cid = (row.raw as { contact_id?: unknown } | null)?.contact_id;
    if (typeof cid !== 'string' || !cid) continue;

    if (!row.promoted) {
      // Pending candidate — always counts as known so re-running Read
      // Contacts doesn't multiply pending entries.
      ids.add(cid);
      continue;
    }
    // Promoted — only counts if the linked person still exists.
    if (row.promoted_person_id && livePersonIds.has(row.promoted_person_id)) {
      ids.add(cid);
    }
    // Orphan (linked person was deleted but this row never got cleaned
    // up): intentionally NOT added so the contact re-imports fresh.
  }
  return ids;
}

export async function fetchSessionCandidates(sessionId: string): Promise<ImportCandidateRow[]> {
  // Paged — a single import of a large Contacts book is itself one session
  // with 1k+ candidates, so the un-paged select used to truncate the wizard
  // review at 1000 and make a 1.4k import *look* complete with no "xx left".
  return fetchAllPaged<ImportCandidateRow>((from, to) =>
    supabase
      .from('import_candidates')
      .select('*')
      .eq('session_id', sessionId)
      .order('ai_relevance_score', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, to),
  );
}

export async function markCandidatePromoted(
  candidateId: string,
  personId: string,
): Promise<void> {
  const { data: cand, error: fetchErr } = await supabase
    .from('import_candidates')
    .select('session_id')
    .eq('id', candidateId)
    .single();
  if (fetchErr) throw fetchErr;
  const { error } = await supabase
    .from('import_candidates')
    .update({ promoted: true, promoted_person_id: personId })
    .eq('id', candidateId);
  if (error) throw error;
  // Bump the session's promoted counter so the People page badge can show
  // "N waiting" without re-counting on every render.
  if (cand?.session_id) {
    const { data: row } = await supabase
      .from('import_sessions')
      .select('promoted_count')
      .eq('id', cand.session_id)
      .single();
    if (row) {
      await supabase
        .from('import_sessions')
        .update({ promoted_count: (row.promoted_count || 0) + 1 })
        .eq('id', cand.session_id);
    }
  }
}

export async function dismissCandidate(candidateId: string): Promise<void> {
  const { error } = await supabase
    .from('import_candidates')
    .update({ dismissed: true })
    .eq('id', candidateId);
  if (error) throw error;
}

/**
 * Dismiss a hand-picked subset of candidates in one round trip (select
 * mode → "Dismiss selected"). Like dismissCandidate but for many ids, so
 * we don't fire one PATCH per row. RLS still confines this to the caller's
 * own rows. No-ops on an empty list.
 */
export async function dismissSelectedCandidates(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Chunk the id list. `.in('id', [...])` serializes every id into the
  // request URL; at ~1k UUIDs that's a ~37KB query string that overflows
  // the URL-length limit and fails the whole request. Splitting keeps each
  // PATCH's URL well within bounds. (Clear-all uses dismissAllPending, which
  // needs no id list at all — prefer that when dismissing everything.)
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase
      .from('import_candidates')
      .update({ dismissed: true })
      .in('id', ids.slice(i, i + CHUNK));
    if (error) throw error;
  }
}

/**
 * Dismiss every still-pending candidate for the current user in one SQL
 * UPDATE. RLS confines the scope to the caller's own rows so we don't
 * need to spell out user_id here. Returns the count of rows touched.
 *
 * The previous Clear-all path iterated client-side with one round trip
 * per row — at 1.5k pending candidates that was 1500 sequential PATCH
 * requests, which both took 90+ seconds and silently maxed out at the
 * default fetch-limit of 1000 rows on the prior `fetchPendingCandidates`
 * call. Switching to a single update fixes both.
 */
export async function dismissAllPending(): Promise<number> {
  const { error, count } = await supabase
    .from('import_candidates')
    .update({ dismissed: true }, { count: 'exact' })
    .eq('promoted', false)
    .eq('dismissed', false);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Persist a free-text feedback message from the Smart Import review screen.
 * Stored in the user's own Supabase project (no email provider wired); the
 * founder reads submissions via the dashboard. RLS scopes rows to the
 * author. `surface` lets the same table collect feedback from other
 * features later.
 */
export async function submitFeedback(input: {
  message: string;
  appVersion?: string;
  surface?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    message: input.message.trim(),
    app_version: input.appVersion ?? null,
    surface: input.surface ?? 'smart_import',
  });
  if (error) throw error;
}
