import { invokeAI } from '@/lib/invoke-ai';
import { updateCandidateRanking } from './storage';
import type { ImportCandidateRow } from './types';

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
 * once every chunk has finished (or rejects on the first failure).
 *
 * Returns the chunks' merged ranking result, in the same order as `candidates`.
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
    const data = await invokeAI<RankResponse>('rank-import-candidates', body as unknown as Record<string, unknown>);
    const ranked = data.ranked || [];
    await Promise.all(
      ranked.map((r) =>
        updateCandidateRanking(r.id, {
          score: r.score,
          rationale: r.rationale,
          bullets: r.bullets,
        }),
      ),
    );
    all.push(...ranked);
  }
  return all;
}

function candidateContext(c: ImportCandidateRow): string | undefined {
  const raw = (c.raw || {}) as Record<string, unknown>;
  const parts: string[] = [];
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
  return parts.length ? parts.join(' · ') : undefined;
}
