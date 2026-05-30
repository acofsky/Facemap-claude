import { supabase } from '@/integrations/supabase/client';
import { createPerson, setPersonCircles, setPersonEvents } from '@/lib/store';
import type { Person } from '@/lib/store';
import { markCandidatePromoted } from './storage';
import type { ImportCandidateRow, MappedPersonFields } from './types';

interface PromoteOverrides {
  /** Caller-supplied bullets for misc_notes (About). If unset, fall back
   *  to the candidate's mapped misc_notes, then to AI bullets. */
  miscNotesBullets?: string[];
  /** Other Person fields the caller wants to override directly — typically
   *  from the inline review sheet where the user edited the form. */
  fieldOverrides?: Partial<Person>;
  /** Circle memberships to set on the new Person. */
  circleIds?: string[];
  /** Event memberships to set on the new Person. */
  eventIds?: string[];
}

/**
 * Turn an import candidate into a real Person. Field mapping order of
 * precedence per slot:
 *   1. Explicit caller override (review sheet)
 *   2. Candidate's mapped fields (spreadsheet column → field)
 *   3. Derived fallbacks (AI bullets for About, source-derived facts
 *      for Background, etc.)
 *
 * The "Imported from X" provenance line lands in About (misc_notes) as
 * the final bullet — explicit reminder that the row came from an
 * automated source without polluting the structured Background field.
 */
export async function promoteCandidate(
  c: ImportCandidateRow,
  overrides?: PromoteOverrides,
): Promise<Person> {
  const mapped = (c.raw as { mapped_fields?: MappedPersonFields } | null)?.mapped_fields || {};
  const about = composeAbout(c, overrides, mapped);
  const background = overrides?.fieldOverrides?.important_info
    ?? composeBackground(c, mapped)
    ?? undefined;

  const person = await createPerson({
    name: overrides?.fieldOverrides?.name ?? (c.name || 'Unnamed'),
    photos: c.photo_path ? [c.photo_path] : [],
    misc_notes: about,
    important_info: background,
    how_we_met: overrides?.fieldOverrides?.how_we_met ?? mapped.how_we_met ?? undefined,
    where_when: overrides?.fieldOverrides?.where_when ?? mapped.where_when ?? undefined,
    date_met: overrides?.fieldOverrides?.date_met ?? undefined,
    physical_description:
      overrides?.fieldOverrides?.physical_description
      ?? mapped.physical_description ?? undefined,
    known_people_notes:
      overrides?.fieldOverrides?.known_people_notes
      ?? mapped.known_people_notes ?? undefined,
  });
  // Apply circle / event memberships if supplied. Done after createPerson
  // so we have the new id; failures here log but don't roll back the
  // promote — the Person row is still valid, just unaffiliated.
  if (overrides?.circleIds && overrides.circleIds.length > 0) {
    await setPersonCircles(person.id, overrides.circleIds).catch((e) => {
      console.warn('Failed to assign circles on promote', e);
    });
  }
  if (overrides?.eventIds && overrides.eventIds.length > 0) {
    await setPersonEvents(person.id, overrides.eventIds).catch((e) => {
      console.warn('Failed to assign events on promote', e);
    });
  }
  await markCandidatePromoted(c.id, person.id);
  return person;
}

/**
 * Merge a candidate into an EXISTING person — pulls in bullets/photo
 * without overwriting fields the user has already filled. Used when the
 * dedupe check matches an incoming stub against someone already in People.
 *
 * When `extraCircleIds` / `extraEventIds` are provided (typically from a
 * bulk-add path), those memberships are ADDED on top of the existing
 * person's current memberships rather than replacing them. Per-row
 * additions are idempotent on the join tables.
 */
export async function mergeCandidateIntoPerson(
  c: ImportCandidateRow,
  personId: string,
  extra?: { circleIds?: string[]; eventIds?: string[] },
): Promise<void> {
  const mapped = (c.raw as { mapped_fields?: MappedPersonFields } | null)?.mapped_fields || {};
  const { data: existing, error: fetchErr } = await supabase
    .from('persons')
    .select('misc_notes, important_info, photos, how_we_met, where_when, physical_description, known_people_notes')
    .eq('id', personId)
    .single();
  if (fetchErr) throw fetchErr;

  const updates: Record<string, unknown> = {};
  const fillIfEmpty = (key: string, incoming: string | null | undefined) => {
    if (!incoming) return;
    const cur = (existing?.[key as keyof typeof existing] || '') as string;
    if (!cur.trim()) updates[key] = incoming;
  };

  fillIfEmpty('misc_notes', composeAbout(c, undefined, mapped));
  fillIfEmpty('important_info', composeBackground(c, mapped));
  fillIfEmpty('how_we_met', mapped.how_we_met);
  fillIfEmpty('where_when', mapped.where_when);
  fillIfEmpty('physical_description', mapped.physical_description);
  fillIfEmpty('known_people_notes', mapped.known_people_notes);
  if (c.photo_path && (!existing?.photos || existing.photos.length === 0)) {
    updates.photos = [c.photo_path];
  }
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('persons').update(updates).eq('id', personId);
    if (error) throw error;
  }
  // Bulk-add can pass a set of circles/events that should apply to
  // everyone in the batch, including merged matches. Add (not set) so
  // the existing person's memberships are preserved.
  if (extra?.circleIds && extra.circleIds.length > 0) {
    await Promise.all(
      extra.circleIds.map((cid) =>
        supabase
          .from('person_circles')
          .upsert({ person_id: personId, circle_id: cid }, { onConflict: 'person_id,circle_id' })
          .then(({ error }) => {
            if (error) console.warn('Failed to add to circle', cid, error);
          }),
      ),
    );
  }
  if (extra?.eventIds && extra.eventIds.length > 0) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.all(
        extra.eventIds.map((eid) =>
          supabase
            .from('person_events')
            .upsert(
              { person_id: personId, event_id: eid, user_id: user.id },
              { onConflict: 'person_id,event_id' },
            )
            .then(({ error }) => {
              if (error) console.warn('Failed to add to event', eid, error);
            }),
        ),
      );
    }
  }
  await markCandidatePromoted(c.id, personId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip the candidate's OWN name off the front of an AI bullet. The model
 * is told not to lead bullets with the person's name, but it occasionally
 * does ("Will Rizzo at Alvarez & Marsal"), which reads as a redundant name
 * repeat once the bullet is saved on that person's profile. We only strip
 * when the bullet starts with THIS candidate's name (plus a trailing
 * separator like " at ", " — ", ", "), so we never touch a legitimate
 * mention of someone else ("Knows John Smith"). If nothing meaningful is
 * left after the name, the bullet is dropped (return '').
 */
export function stripOwnName(bullet: string, name: string | null | undefined): string {
  const b = bullet.trim();
  const n = (name || '').trim();
  if (!n) return b;
  if (b.toLowerCase().startsWith(n.toLowerCase())) {
    // Remove the name, then a leading separator (" at ", " — ", " - ",
    // " – ", ",", ":") if present.
    let rest = b.slice(n.length).replace(/^\s*(?:[—–\-:,]|\bat\b)\s*/i, '').trim();
    // A bare leftover like "at" or punctuation isn't a fact — drop it.
    if (!rest || /^[—–\-:,.]+$/.test(rest)) return '';
    // Re-capitalize a lone firm/role fragment for tidiness.
    rest = rest.charAt(0).toUpperCase() + rest.slice(1);
    return rest;
  }
  return b;
}

function composeAbout(
  c: ImportCandidateRow,
  overrides: PromoteOverrides | undefined,
  mapped: MappedPersonFields,
): string {
  // 1) explicit caller bullets win outright
  if (overrides?.miscNotesBullets && overrides.miscNotesBullets.length > 0) {
    return [
      ...overrides.miscNotesBullets,
      `Imported from ${sourceLabel(c.source)}`,
    ].map((line) => `• ${line.trim()}`).join('\n');
  }

  // 2) mapped notes column from the spreadsheet
  const aboutParts: string[] = [];
  if (mapped.misc_notes) {
    aboutParts.push(mapped.misc_notes.trim());
  } else {
    // 3) fall back to AI-generated bullets when no mapped notes exist.
    // Strip any leading self-name the model slipped in so the saved
    // About doesn't read "[their own name] at [firm]".
    const aiBullets = ((c.ai_bullets as string[] | null) || [])
      .map((b) => stripOwnName(b, c.name))
      .filter(Boolean);
    aboutParts.push(...aiBullets);
  }
  aboutParts.push(`Imported from ${sourceLabel(c.source)}`);

  // Format every line as a bullet so it renders in BulletDisplay.
  return aboutParts
    .filter(Boolean)
    .flatMap((p) => p.split('\n').map((line) => line.replace(/^\s*[•\-*]\s*/, '').trim()))
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');
}

function composeBackground(c: ImportCandidateRow, mapped: MappedPersonFields): string | undefined {
  const lines: string[] = [];
  if (c.title || c.company) {
    lines.push([c.title, c.company].filter(Boolean).join(' at '));
  }
  if (c.email) lines.push(`Email: ${c.email}`);
  if (c.phone) lines.push(`Phone: ${c.phone}`);
  // Source-mapped Background entries (Contacts URLs/birthday, spreadsheet
  // Important column, etc.) get split on newlines so each line lands as
  // its own bullet in the BulletDisplay component.
  if (mapped.important_info) {
    mapped.important_info.split('\n').forEach((raw) => {
      const trimmed = raw.replace(/^\s*[•\-*]\s*/, '').trim();
      if (trimmed) lines.push(trimmed);
    });
  }
  if (lines.length === 0) return undefined;
  return lines.map((l) => `• ${l}`).join('\n');
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'contacts': return 'iOS Contacts';
    case 'linkedin': return 'LinkedIn export';
    case 'spreadsheet': return 'a spreadsheet';
    case 'calendar': return 'Calendar';
    case 'photo_ocr': return 'a photo';
    default: return source;
  }
}
