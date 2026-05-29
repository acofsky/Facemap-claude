import { invokeAI } from '@/lib/invoke-ai';
import { updateCandidateRanking } from './storage';
import type { ImportCandidateRow, MappedPersonFields } from './types';

interface RankRequest {
  filter_text?: string;
  candidates: Array<{
    id: string;
    source: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    title?: string;
    context?: string;
  }>;
}

interface RankResponse {
  ranked: Array<{ id: string; score: number; rationale: string; bullets: string[] }>;
}

// 15 candidates per chunk. CHUNK_SIZE=25 was still producing failures
// in the field — at ~300 output tokens per row (the richer prompt
// produces longer rationales) × 25 = ~7.5k tokens, Haiku 4.5's
// streaming runtime was hitting the iOS WebView's ~60s fetch ceiling
// on some chunks. Halving to 15 keeps each request under ~30s in the
// worst case, well clear of any timeout. More smaller chunks is fine
// since they run in parallel waves of MAX_CONCURRENT_CHUNKS anyway.
const CHUNK_SIZE = 15;
// Fan-out cap for parallel chunks. Anthropic's default tier accepts 50
// concurrent requests; keeping the limit lower than that avoids stepping
// on other AI features (briefs, photo-describe, voice-parse) that share
// the same key.
const MAX_CONCURRENT_CHUNKS = 4;

/**
 * Send candidates to the rank-import-candidates edge function in chunks,
 * write the resulting scores/rationales/bullets back to the DB. Chunks
 * fan out in parallel (capped) so a 200-contact import doesn't crawl
 * through 8 sequential edge-function cold starts. Per-row DB update
 * failures are tolerated (logged and skipped) so a single bad write
 * can't kill the whole pass.
 */
export async function rankCandidates(
  filterText: string,
  candidates: ImportCandidateRow[],
): Promise<RankResponse['ranked']> {
  const chunks: ImportCandidateRow[][] = [];
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    chunks.push(candidates.slice(i, i + CHUNK_SIZE));
  }

  const all: RankResponse['ranked'] = [];
  let failedChunks = 0;
  // Run chunks in waves so we never hold more than MAX_CONCURRENT_CHUNKS
  // in flight at once. Each wave waits for its chunks to settle before
  // the next wave kicks off — failures in one wave don't cascade.
  for (let w = 0; w < chunks.length; w += MAX_CONCURRENT_CHUNKS) {
    const wave = chunks.slice(w, w + MAX_CONCURRENT_CHUNKS);
    const results = await Promise.allSettled(wave.map((chunk) => runChunk(filterText, chunk)));
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        all.push(...r.value);
      } else {
        failedChunks++;
        console.warn('Rank chunk failed', w + idx, r.reason);
      }
    });
  }
  // Tolerate partial failures. The previous commit threw if ANY chunk
  // failed, which sounded clean but in practice meant 1 timeout out of
  // 10 chunks tanked the whole batch's results — even though 9 chunks
  // worth of contacts had been ranked perfectly. iOS WebView fetches
  // sometimes give up on slow chunks before Haiku 4.5 finishes
  // streaming, which presents as an isolated rejection inside an
  // otherwise-healthy run. The successful chunks' candidates keep
  // their real scores and surface at the top; failed chunks' candidates
  // keep null score and sort to the bottom (orderBy nullsFirst:false).
  // Only throw if absolutely nothing came back — that's a real outage.
  if (failedChunks > 0 && all.length === 0) {
    throw new Error(`All ${chunks.length} ranking chunks failed`);
  }
  if (failedChunks > 0) {
    console.warn(`${failedChunks}/${chunks.length} rank chunks failed; ${all.length} candidates have real scores, the rest sort unranked at the bottom`);
  }
  return all;
}

async function runChunk(
  filterText: string,
  chunk: ImportCandidateRow[],
): Promise<RankResponse['ranked']> {
  const body: RankRequest = {
    filter_text: filterText || undefined,
    candidates: chunk.map((c) => ({
      id: c.id,
      source: c.source,
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
      company: c.company || undefined,
      title: c.title || undefined,
      context: candidateContext(c),
    })),
  };
  const data = await invokeAI<RankResponse>(
    'rank-import-candidates',
    body as unknown as Record<string, unknown>,
  );
  const ranked = data.ranked || [];
  const updates = await Promise.allSettled(
    ranked.map((r) =>
      updateCandidateRanking(r.id, {
        score: r.score,
        rationale: r.rationale,
        bullets: r.bullets,
      }),
    ),
  );
  updates.forEach((u, idx) => {
    if (u.status === 'rejected') {
      console.warn('Failed to persist ranking for', ranked[idx]?.id, u.reason);
    }
  });
  return ranked;
}

function candidateContext(c: ImportCandidateRow): string | undefined {
  const raw = (c.raw || {}) as Record<string, unknown>;
  const parts: string[] = [];

  // Spreadsheet-mapped fields carry the real signal for filter-matching —
  // surface them to the AI verbatim so scoring against the filter has
  // something to work with beyond name + title.
  const mapped = raw.mapped_fields as MappedPersonFields | undefined;
  if (mapped) {
    if (mapped.how_we_met) parts.push(`How met: ${truncate(mapped.how_we_met, 200)}`);
    if (mapped.where_when) parts.push(`Where: ${truncate(mapped.where_when, 120)}`);
    if (mapped.misc_notes) parts.push(`Notes: ${truncate(mapped.misc_notes, 240)}`);
    if (mapped.important_info) parts.push(`Important: ${truncate(mapped.important_info, 240)}`);
    if (mapped.physical_description) parts.push(`Looks: ${truncate(mapped.physical_description, 160)}`);
    if (mapped.known_people_notes) parts.push(`Knows: ${truncate(mapped.known_people_notes, 200)}`);
  }
  // Raw spreadsheet context (truly unmapped columns) the parser folded in.
  if (typeof raw.context === 'string' && raw.context.trim()) {
    parts.push(truncate(raw.context, 400));
  }

  // Source-specific aggregations from other adapters.
  if (typeof raw.meeting_count === 'number' && raw.meeting_count > 0) {
    parts.push(`${raw.meeting_count} calendar meetings`);
  }
  if (Array.isArray(raw.event_titles) && raw.event_titles.length > 0) {
    parts.push(`Events: ${(raw.event_titles as string[]).slice(0, 3).join('; ')}`);
  }
  if (typeof raw.connected_on === 'string') {
    parts.push(`LinkedIn connected ${raw.connected_on}`);
  }
  if (typeof raw.linkedin_url === 'string') {
    parts.push('Has LinkedIn URL');
  }
  if (typeof raw.from_group_photo === 'string') {
    parts.push(`Extracted from photo`);
  }

  if (parts.length === 0) return undefined;
  const joined = parts.join(' · ');
  return joined.length > 1000 ? joined.slice(0, 1000).trimEnd() + '…' : joined;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}
