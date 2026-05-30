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

export async function fetchPendingCandidates(): Promise<ImportCandidateRow[]> {
  // Supabase's default fetch cap is 1000 rows. With users testing imports
  // multiple times against large Contacts books, 1k is easy to exceed,
  // and the truncated list would silently hide entries from the pending
  // sheet (and from any bulk action that iterated client-side). Explicit
  // higher limit; the API still pages further if needed.
  const { data, error } = await supabase
    .from('import_candidates')
    .select('*')
    .eq('promoted', false)
    .eq('dismissed', false)
    .order('ai_relevance_score', { ascending: false, nullsFirst: false })
    .limit(5000);
  if (error) throw error;
  return data || [];
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
  const [candResult, personResult] = await Promise.all([
    supabase
      .from('import_candidates')
      .select('raw, promoted, promoted_person_id')
      .eq('source', 'contacts')
      .eq('dismissed', false),
    supabase.from('persons').select('id'),
  ]);
  if (candResult.error) throw candResult.error;
  if (personResult.error) throw personResult.error;

  const livePersonIds = new Set((personResult.data || []).map((p) => p.id));
  const ids = new Set<string>();
  for (const row of candResult.data || []) {
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
  const { data, error } = await supabase
    .from('import_candidates')
    .select('*')
    .eq('session_id', sessionId)
    .order('ai_relevance_score', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
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
