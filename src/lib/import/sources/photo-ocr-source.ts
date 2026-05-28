import { invokeAI } from '@/lib/invoke-ai';
import { getPhotoUrl, uploadPhoto } from '@/lib/store';
import type { CandidateDraft } from '../types';

interface PhotoExtractedPerson {
  name: string;
  role?: string;
  company?: string;
}

interface PhotoExtractResponse {
  people?: PhotoExtractedPerson[];
}

/**
 * Run a single image through the AI and pull out the people it can name.
 * Uses the existing describe-from-photo function with an extraction-mode
 * prompt (set via the `mode` field). Each returned person becomes a draft;
 * the source photo is attached to every draft so the user can crop later.
 *
 * Names come from visible captions/badges/text — photo-only headshots
 * without any name tag return zero people and the user gets a friendly
 * empty state.
 */
export async function gatherPhotoOcrCandidates(file: File): Promise<CandidateDraft[]> {
  const storagePath = await uploadPhoto(file);
  const signedUrl = await getPhotoUrl(storagePath);

  const data = await invokeAI<PhotoExtractResponse>('describe-from-photo', {
    photoUrl: signedUrl,
    mode: 'extract_people',
  });

  const people = Array.isArray(data?.people) ? data.people : [];
  if (people.length === 0) return [];

  return people
    .filter((p) => p.name?.trim())
    .map((p) => ({
      source: 'photo_ocr' as const,
      name: p.name.trim(),
      title: p.role?.trim() || undefined,
      company: p.company?.trim() || undefined,
      photoPath: storagePath,
      raw: { from_group_photo: storagePath },
    }));
}
