import { supabase } from '@/integrations/supabase/client';
import { createPerson } from '@/lib/store';
import type { Person } from '@/lib/store';
import { markCandidatePromoted } from './storage';
import type { ImportCandidateRow } from './types';

/**
 * Turn an import candidate into a real Person. AI bullets land in the
 * About field; source-derived facts (email/phone/company/title, plus a
 * one-line provenance) land in Background so the user can still see where
 * the row came from. Photo, if any, is copied verbatim.
 */
export async function promoteCandidate(c: ImportCandidateRow): Promise<Person> {
  const about = bulletsToText((c.ai_bullets as string[] | null) || []);
  const background = backgroundFromCandidate(c);

  const person = await createPerson({
    name: c.name || 'Unnamed',
    photos: c.photo_path ? [c.photo_path] : [],
    misc_notes: about || undefined,
    important_info: background || undefined,
  });
  await markCandidatePromoted(c.id, person.id);
  return person;
}

/**
 * Merge a candidate into an EXISTING person — pulls in bullets/photo
 * without overwriting fields the user has already filled. Used when the
 * dedupe check matches an incoming stub against someone already in People.
 */
export async function mergeCandidateIntoPerson(
  c: ImportCandidateRow,
  personId: string,
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('persons')
    .select('misc_notes, important_info, photos')
    .eq('id', personId)
    .single();
  if (fetchErr) throw fetchErr;

  const updates: Record<string, unknown> = {};
  const incomingAbout = bulletsToText((c.ai_bullets as string[] | null) || []);
  const incomingBg = backgroundFromCandidate(c);
  if (incomingAbout && !(existing?.misc_notes || '').trim()) {
    updates.misc_notes = incomingAbout;
  }
  if (incomingBg && !(existing?.important_info || '').trim()) {
    updates.important_info = incomingBg;
  }
  if (c.photo_path && (!existing?.photos || existing.photos.length === 0)) {
    updates.photos = [c.photo_path];
  }
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('persons').update(updates).eq('id', personId);
    if (error) throw error;
  }
  await markCandidatePromoted(c.id, personId);
}

function bulletsToText(bullets: string[]): string {
  return bullets
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => `• ${b}`)
    .join('\n');
}

function backgroundFromCandidate(c: ImportCandidateRow): string {
  const lines: string[] = [];
  if (c.title || c.company) {
    lines.push([c.title, c.company].filter(Boolean).join(' at '));
  }
  if (c.email) lines.push(`Email: ${c.email}`);
  if (c.phone) lines.push(`Phone: ${c.phone}`);
  lines.push(`Imported from ${sourceLabel(c.source)}`);
  return lines.join('\n');
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'contacts': return 'iOS Contacts';
    case 'linkedin': return 'LinkedIn export';
    case 'calendar': return 'Calendar';
    case 'photo_ocr': return 'a photo';
    default: return source;
  }
}
