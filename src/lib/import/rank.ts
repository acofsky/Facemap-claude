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
 * Result of a ranking pass. `ranked` is every candidate that got a real
 * AI score this pass. `unscoredIds` is candidates whose chunk failed
 * (timeout, parse failure, etc.) and therefore still have NULL score in
 * the DB — the caller uses this to surface a retry affordance instead of
 * silently leaving genuine matches stranded at the bottom of the drawer.
 */
export interface RankOutcome {
  ranked: RankResponse['ranked'];
  unscoredIds: string[];
}

// Within a single rankCandidates call, failed chunks get a few automatic
// re-attempts before we hand the leftovers back to the caller. The most
// common failure is a transient iOS WebView fetch timeout on a slow chunk;
// immediate retries clear the bulk of those. The caller (ImportPage) also
// runs its own background re-rank loop on whatever's still unscored, so
// between the two layers the user effectively never has to retry by hand —
// but the cap here keeps a single call from spinning forever on a true
// outage (the caller's loop has its own cap too).
const CHUNK_RETRY_ATTEMPTS = 2;

/**
 * Send candidates to the rank-import-candidates edge function in chunks,
 * write the resulting scores/rationales/bullets back to the DB. Chunks
 * fan out in parallel (capped) so a 200-contact import doesn't crawl
 * through 8 sequential edge-function cold starts. Per-row DB update
 * failures are tolerated (logged and skipped) so a single bad write
 * can't kill the whole pass.
 *
 * Returns a RankOutcome so the caller knows EXACTLY which candidates
 * never got scored (failed chunks). Previously partial failures were
 * completely silent: if 5 of 27 chunks timed out, ~75 candidates kept
 * NULL scores, sorted to the bottom of the drawer, and nothing told the
 * user they'd never actually been looked at. Now those ids come back so
 * the review screen can offer a real "N couldn't be scored — retry".
 */
export async function rankCandidates(
  filterText: string,
  candidates: ImportCandidateRow[],
): Promise<RankOutcome> {
  const chunks: ImportCandidateRow[][] = [];
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    chunks.push(candidates.slice(i, i + CHUNK_SIZE));
  }

  const all: RankResponse['ranked'] = [];
  // Track which chunks (by their candidate rows) still need scoring so we
  // can re-attempt just the failures rather than the whole batch.
  let pending = chunks;

  for (let attempt = 0; attempt <= CHUNK_RETRY_ATTEMPTS && pending.length > 0; attempt++) {
    // Brief backoff before each retry pass so a transient blip (token
    // refresh, network hiccup) has a moment to clear instead of getting
    // hammered by an immediate re-fire.
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800 * attempt));
    const stillFailed: ImportCandidateRow[][] = [];
    // Run chunks in waves so we never hold more than MAX_CONCURRENT_CHUNKS
    // in flight at once. Each wave waits for its chunks to settle before
    // the next wave kicks off — failures in one wave don't cascade.
    for (let w = 0; w < pending.length; w += MAX_CONCURRENT_CHUNKS) {
      const wave = pending.slice(w, w + MAX_CONCURRENT_CHUNKS);
      const results = await Promise.allSettled(wave.map((chunk) => runChunk(filterText, chunk)));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          all.push(...r.value);
        } else {
          stillFailed.push(wave[idx]);
          console.warn('Rank chunk failed', attempt > 0 ? '(retry)' : '', r.reason);
        }
      });
    }
    pending = stillFailed;
  }

  // Anything still pending after the retry pass never got scored. Surface
  // its ids so the caller can show the retry banner; these rows keep NULL
  // score in the DB and sort to the bottom (orderBy nullsFirst:false).
  const unscoredIds = pending.flat().map((c) => c.id);

  // Only treat the whole pass as a hard failure when NOTHING came back —
  // that's a real outage worth throwing on. A partial failure returns
  // normally with unscoredIds populated so the UI can offer a retry.
  if (unscoredIds.length > 0 && all.length === 0) {
    throw new Error(`All ${chunks.length} ranking chunks failed`);
  }
  if (unscoredIds.length > 0) {
    console.warn(`${unscoredIds.length} candidates still unscored after retry; ${all.length} have real scores`);
  }
  return { ranked: all, unscoredIds };
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
