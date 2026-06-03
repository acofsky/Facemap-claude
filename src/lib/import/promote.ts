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
    // Auto-link people imported from iOS Contacts to their source contact,
    // so the Person detail page shows "Linked" + "Open contact" with no
    // manual step. The id captured at import (raw.contact_id) is the same
    // CNContact identifier the link/open native calls use.
    ios_contact_id: iosContactIdFrom(c) ?? undefined,
    // Parallel auto-link for LinkedIn imports: the connections export carries
    // each person's profile URL, so a promoted LinkedIn candidate lands
    // already linked to their LinkedIn profile.
    linkedin_url: linkedInUrlFrom(c) ?? undefined,
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
    .select('misc_notes, important_info, photos, how_we_met, where_when, physical_description, known_people_notes, ios_contact_id, linkedin_url')
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
  // Auto-link to the source iPhone contact when merging an iOS Contacts
  // candidate into someone not already linked. Never overwrite an existing
  // link the user may have set deliberately.
  fillIfEmpty('ios_contact_id', iosContactIdFrom(c));
  // Same for LinkedIn imports merged into an existing, unlinked person.
  fillIfEmpty('linkedin_url', linkedInUrlFrom(c));
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
 * The source iPhone contact id for an import candidate, if it came from the
 * iOS Contacts source and carries one. Only contacts-source rows have a
 * usable CNContact identifier; other sources (LinkedIn, spreadsheet, photo)
 * return undefined so nothing gets falsely linked.
 */
function iosContactIdFrom(c: ImportCandidateRow): string | undefined {
  if (c.source !== 'contacts') return undefined;
  const id = (c.raw as { contact_id?: unknown } | null)?.contact_id;
  return typeof id === 'string' && id.trim() ? id : undefined;
}

/**
 * The LinkedIn profile URL for a candidate, if it came from the LinkedIn
 * source and the export carried a URL. Other sources return undefined so
 * nothing gets falsely linked.
 */
function linkedInUrlFrom(c: ImportCandidateRow): string | undefined {
  if (c.source !== 'linkedin') return undefined;
  const url = (c.raw as { linkedin_url?: unknown } | null)?.linkedin_url;
  return typeof url === 'string' && url.trim() ? url.trim() : undefined;
}

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

/**
 * True when an AI bullet merely restates structured data that already
 * lands in the Background field (the candidate's company, title, or
 * "title at company"). Those facts belong in Background, so echoing them
 * in About is pure duplication — e.g. a contact whose only signal is
 * company "M3 Consulting" would otherwise show "M3 Consulting" in BOTH
 * About and Background. Domain-agnostic: compares normalized text, so it
 * works for any field value, not any particular industry.
 */
export function bulletDuplicatesStructured(
  bullet: string,
  c: { company?: string | null; title?: string | null },
): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = norm(bullet);
  if (!b) return false;
  const company = c.company ? norm(c.company) : '';
  const title = c.title ? norm(c.title) : '';
  const titleAtCompany = c.title && c.company ? norm(`${c.title} at ${c.company}`) : '';
  return (
    (!!company && b === company) ||
    (!!title && b === title) ||
    (!!titleAtCompany && b === titleAtCompany)
  );
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
    // About doesn't read "[their own name] at [firm]", and drop any bullet
    // that just restates the company/title already headed to Background —
    // otherwise a contact whose only signal is their company shows it in
    // both fields.
    const aiBullets = ((c.ai_bullets as string[] | null) || [])
      .map((b) => stripOwnName(b, c.name))
      .filter(Boolean)
      .filter((b) => !bulletDuplicatesStructured(b, c));
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
