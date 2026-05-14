import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Person = Tables<'persons'>;
export type Circle = Tables<'circles'>;
export type PersonCircle = Tables<'person_circles'>;
export type Connection = Tables<'connections'>;
export type Meeting = Tables<'meetings'>;
export type Event = Tables<'events'>;
export type PersonEvent = Tables<'person_events'>;

/**
 * Twelve named tones, ordered around the colour wheel so the picker reads
 * as a spectrum (red → orange → … → rose → slate). Source of truth for
 * tile gradients; the matching `.tile-{name}` classes live in index.css.
 */
export const TONES = [
  'red', 'orange', 'amber', 'green', 'mint', 'teal',
  'blue', 'indigo', 'purple', 'fuchsia', 'rose', 'slate',
] as const;
export type Tone = (typeof TONES)[number];
export function isValidTone(t: string | null | undefined): t is Tone {
  return !!t && (TONES as readonly string[]).includes(t);
}

// ---- Persons ----

export async function fetchPersons(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchPerson(
  id: string,
): Promise<Person & { circleIds: string[]; eventIds: string[] }> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;

  const [{ data: pc }, { data: pe }] = await Promise.all([
    supabase.from('person_circles').select('circle_id').eq('person_id', id),
    supabase.from('person_events').select('event_id').eq('person_id', id),
  ]);

  return {
    ...data,
    circleIds: (pc || []).map((r) => r.circle_id),
    eventIds: (pe || []).map((r) => r.event_id),
  };
}

export async function createPerson(input: Partial<{
  name: string;
  photos: string[];
  how_we_met: string;
  where_when: string;
  date_met: string;
  physical_description: string;
  important_info: string;
  known_people_notes: string;
  misc_notes: string;
  reminder_date: string;
  reminder_note: string;
}>): Promise<Person> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('persons')
    .insert({
      user_id: user.id,
      name: input.name || '',
      photos: input.photos || [],
      how_we_met: input.how_we_met || null,
      where_when: input.where_when || null,
      date_met: input.date_met || null,
      physical_description: input.physical_description || null,
      important_info: input.important_info || null,
      known_people_notes: input.known_people_notes || null,
      misc_notes: input.misc_notes || null,
      reminder_date: input.reminder_date || null,
      reminder_note: input.reminder_note || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePerson(id: string, updates: TablesUpdate<'persons'>): Promise<Person> {
  const { data, error } = await supabase
    .from('persons')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from('persons').delete().eq('id', id);
  if (error) throw error;
}

// ---- Circles ----

export async function fetchCircles(): Promise<Circle[]> {
  const { data, error } = await supabase
    .from('circles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCircle(input: { name: string; emoji: string; color: string; tone?: string }): Promise<Circle> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('circles')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCircle(id: string, updates: { name?: string; emoji?: string; color?: string; tone?: string }): Promise<Circle> {
  const { data, error } = await supabase
    .from('circles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCircle(id: string): Promise<void> {
  // Remove all person_circles for this circle first
  await supabase.from('person_circles').delete().eq('circle_id', id);
  const { error } = await supabase.from('circles').delete().eq('id', id);
  if (error) throw error;
}

export async function addPersonToCircle(personId: string, circleId: string): Promise<void> {
  const { error } = await supabase
    .from('person_circles')
    .insert({ person_id: personId, circle_id: circleId });
  if (error) throw error;
}

export async function removePersonFromCircle(personId: string, circleId: string): Promise<void> {
  const { error } = await supabase
    .from('person_circles')
    .delete()
    .eq('person_id', personId)
    .eq('circle_id', circleId);
  if (error) throw error;
}

// ---- Person Circles ----

export async function setPersonCircles(personId: string, circleIds: string[]): Promise<void> {
  // Delete existing
  await supabase.from('person_circles').delete().eq('person_id', personId);
  // Insert new
  if (circleIds.length > 0) {
    const { error } = await supabase
      .from('person_circles')
      .insert(circleIds.map(circle_id => ({ person_id: personId, circle_id })));
    if (error) throw error;
  }
}

export async function fetchPersonCircles(): Promise<PersonCircle[]> {
  const { data, error } = await supabase.from('person_circles').select('*');
  if (error) throw error;
  return data;
}

// ---- Connections ----

export async function fetchConnections(): Promise<Connection[]> {
  const { data, error } = await supabase.from('connections').select('*');
  if (error) throw error;
  return data;
}

export async function createConnection(personAId: string, personBId: string, note?: string): Promise<Connection> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('connections')
    .insert({ person_a_id: personAId, person_b_id: personBId, note: note || null, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConnection(id: string): Promise<void> {
  const { error } = await supabase.from('connections').delete().eq('id', id);
  if (error) throw error;
}

// ---- Meetings ----

export async function fetchMeetingsForPerson(personId: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('person_id', personId)
    .order('meeting_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchRecentMeetings(sinceISODate: string): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .gte('meeting_date', sinceISODate)
    .order('meeting_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMeeting(input: { person_id: string; meeting_date: string; place?: string; notes?: string }): Promise<Meeting> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      user_id: user.id,
      person_id: input.person_id,
      meeting_date: input.meeting_date,
      place: input.place || null,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMeeting(id: string, updates: { meeting_date?: string; place?: string | null; notes?: string | null }): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) throw error;
}

// ---- Photo Upload ----

export async function uploadPhoto(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const ext = file.name.split('.').pop() || 'jpg';
  // Files MUST live under the user's folder for RLS to allow access
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('person-photos')
    .upload(path, file);
  if (error) throw error;
  // Return the storage path; UI resolves it to a signed URL on demand
  return path;
}

// Resolve a stored photo path (or legacy public URL) to a viewable URL
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getPhotoUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return pathOrUrl;
  // Legacy: full URL stored before bucket was made private — return as-is
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const cached = signedUrlCache.get(pathOrUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage
    .from('person-photos')
    .createSignedUrl(pathOrUrl, 60 * 60); // 1 hour
  if (error || !data) throw error || new Error('Failed to sign URL');
  signedUrlCache.set(pathOrUrl, {
    url: data.signedUrl,
    expiresAt: Date.now() + 55 * 60 * 1000,
  });
  return data.signedUrl;
}

// ---- Events ----

export async function fetchEvents(opts: { includeArchived?: boolean } = {}): Promise<Event[]> {
  let q = supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false });
  if (!opts.includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createEvent(input: {
  name: string;
  tone?: string;
  start_date?: string | null;
  end_date?: string | null;
}): Promise<Event> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: user.id,
      name: input.name,
      tone: input.tone || 'red',
      start_date: input.start_date || null,
      end_date: input.end_date || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  id: string,
  updates: Partial<{ name: string; tone: string; start_date: string | null; end_date: string | null }>,
): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveEvent(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

// ---- person_events join ----

export async function fetchPersonEvents(): Promise<PersonEvent[]> {
  const { data, error } = await supabase.from('person_events').select('*');
  if (error) throw error;
  return data;
}

export async function setPersonEvents(personId: string, eventIds: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: existing } = await supabase
    .from('person_events')
    .select('id, event_id')
    .eq('person_id', personId);
  const currentIds = new Set((existing || []).map((r) => r.event_id));
  const nextIds = new Set(eventIds);
  const toAdd = [...nextIds].filter((id) => !currentIds.has(id));
  const toRemove = (existing || []).filter((r) => !nextIds.has(r.event_id));
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('person_events')
      .insert(toAdd.map((event_id) => ({ user_id: user.id, person_id: personId, event_id })));
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('person_events')
      .delete()
      .in('id', toRemove.map((r) => r.id));
    if (error) throw error;
  }
}

