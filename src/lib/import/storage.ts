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
  const { data, error } = await supabase
    .from('import_candidates')
    .select('*')
    .eq('promoted', false)
    .eq('dismissed', false)
    .order('ai_relevance_score', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

/**
 * Collect the iOS contact_ids that are currently sitting in import_candidates
 * (any state — pending, promoted, or dismissed). Used by the Contacts source
 * to skip contacts the user has already imported in a previous session
 * instead of silently re-pulling them and watching them get dedup'd later.
 */
export async function fetchKnownContactIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('import_candidates')
    .select('raw')
    .eq('source', 'contacts');
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data || []) {
    const cid = (row.raw as { contact_id?: unknown } | null)?.contact_id;
    if (typeof cid === 'string' && cid) ids.add(cid);
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
