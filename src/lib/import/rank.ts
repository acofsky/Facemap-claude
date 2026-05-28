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

// Matches the edge function's MAX_CANDIDATES_PER_CALL. Keep under or the
// function 400s the whole batch.
const CHUNK_SIZE = 60;

/**
 * Send candidates to the rank-import-candidates edge function in chunks,
 * write the resulting scores/rationales/bullets back to the DB. Resolves
 * once every chunk has finished. Per-row DB update failures are tolerated
 * (logged and skipped) so a single bad write can't kill the whole pass.
 */
export async function rankCandidates(
  filterText: string,
  candidates: ImportCandidateRow[],
): Promise<RankResponse['ranked']> {
  const all: RankResponse['ranked'] = [];
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
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
    all.push(...ranked);
  }
  return all;
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
