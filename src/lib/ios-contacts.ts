import { Capacitor } from '@capacitor/core';
import { Contacts, type ContactPayload } from '@capacitor-community/contacts';
import { getPhotoUrl } from '@/lib/store';

/** True only inside the native iOS Capacitor build. */
export function isNativeIOS(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

async function ensurePermission(): Promise<boolean> {
  const perm = await Contacts.requestPermissions();
  return perm.contacts === 'granted';
}

/**
 * Show the iOS contact picker and return the selected contact's id + display name.
 */
export async function pickIOSContact(): Promise<{ id: string; name: string } | null> {
  if (!isNativeIOS()) throw new Error('Contacts integration only works in the iOS app build.');
  if (!(await ensurePermission())) throw new Error('Contacts permission denied.');
  const result = await Contacts.pickContact({ projection: { name: true } });
  const c = result?.contact as ContactPayload | undefined;
  if (!c) return null;
  const name =
    c.name?.display ||
    [c.name?.given, c.name?.family].filter(Boolean).join(' ') ||
    'Unnamed';
  return { id: c.contactId, name };
}

// ---------- Smart extraction from free-text FaceMap fields ----------

const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_RE = /([\w.+-]+@[\w-]+\.[\w.-]+)/;
// Birthday patterns: "bday March 4", "birthday: 1995-08-12", "born Apr 7 1990"
const BDAY_KEYWORD_RE =
  /(?:b(?:irth)?day|born)[^a-z0-9]{0,4}([A-Za-z0-9 ,/.\-]{3,30})/i;

function tryParseDate(raw: string): { y?: number; m: number; d: number } | null {
  const s = raw.trim().replace(/[,.]/g, ' ').replace(/\s+/g, ' ');
  // ISO 1995-08-12 or 08-12
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return { y: +iso[1], m: +iso[2], d: +iso[3] };
  const md = s.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (md) {
    const y = md[3] ? (+md[3] < 100 ? 2000 + +md[3] : +md[3]) : undefined;
    return { m: +md[1], d: +md[2], y };
  }
  // Month-name forms: "March 4" / "Apr 7 1990" / "4 March 1990"
  const months = [
    'january','february','march','april','may','june',
    'july','august','september','october','november','december',
  ];
  const tokens = s.toLowerCase().split(' ');
  let monthIdx = -1, day: number | undefined, year: number | undefined;
  for (const t of tokens) {
    const mi = months.findIndex(m => m.startsWith(t.slice(0, 3)));
    if (mi !== -1 && monthIdx === -1) monthIdx = mi;
    else if (/^\d{4}$/.test(t)) year = +t;
    else if (/^\d{1,2}$/.test(t) && day === undefined) day = +t;
  }
  if (monthIdx !== -1 && day) return { y: year, m: monthIdx + 1, d: day };
  return null;
}

interface Extracted {
  phone?: string;
  email?: string;
  birthday?: { y?: number; m: number; d: number };
}

function extractFromText(...texts: (string | null | undefined)[]): Extracted {
  const blob = texts.filter(Boolean).join('\n');
  const out: Extracted = {};
  const phone = blob.match(PHONE_RE);
  if (phone) out.phone = phone[1].trim();
  const email = blob.match(EMAIL_RE);
  if (email) out.email = email[1].trim();
  const bday = blob.match(BDAY_KEYWORD_RE);
  if (bday) {
    const parsed = tryParseDate(bday[1]);
    if (parsed) out.birthday = parsed;
  }
  return out;
}

function buildNote(p: PersonForExport): string | undefined {
  const lines: string[] = [];
  if (p.how_we_met) lines.push(`How we met: ${p.how_we_met}`);
  if (p.where_when) lines.push(`Where: ${p.where_when}`);
  if (p.important_info) lines.push(`Important: ${p.important_info}`);
  if (p.misc_notes) lines.push(`Notes: ${p.misc_notes}`);
  if (p.known_people_notes) lines.push(`Knows: ${p.known_people_notes}`);
  if (lines.length === 0) return 'Linked from FaceMap';
  return ['— From FaceMap —', ...lines].join('\n');
}

async function fetchPhotoBase64(photoPath: string): Promise<string | null> {
  try {
    const url = await getPhotoUrl(photoPath);
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // strip data:image/...;base64, prefix — plugin wants raw base64
        resolve(result.split(',')[1] || result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface PersonForExport {
  name: string;
  photos?: string[] | null;
  date_met?: string | null;
  how_we_met?: string | null;
  where_when?: string | null;
  important_info?: string | null;
  misc_notes?: string | null;
  known_people_notes?: string | null;
  physical_description?: string | null;
}

/**
 * Create an iOS contact from a full FaceMap person, porting over anything
 * that maps cleanly to a Contacts field.
 */
export async function createIOSContactFromPerson(p: PersonForExport): Promise<string | null> {
  if (!isNativeIOS()) throw new Error('Contacts integration only works in the iOS app build.');
  if (!(await ensurePermission())) throw new Error('Contacts permission denied.');

  const [given, ...rest] = (p.name || '').trim().split(/\s+/);
  const family = rest.join(' ') || undefined;

  const extracted = extractFromText(
    p.important_info,
    p.misc_notes,
    p.known_people_notes,
    p.physical_description,
    p.how_we_met,
    p.where_when,
  );

  // Photo
  let imageBase64: string | undefined;
  const firstPhoto = p.photos?.[0];
  if (firstPhoto) {
    const b64 = await fetchPhotoBase64(firstPhoto);
    if (b64) imageBase64 = b64;
  }

  // Dates: "Met" custom-labeled, plus optional birthday
  const dates: any[] = [];
  if (p.date_met) {
    const d = new Date(p.date_met);
    if (!isNaN(d.getTime())) {
      dates.push({
        label: 'Met',
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
      });
    }
  }

  const contact: any = {
    name: { given: given || p.name, family },
    note: buildNote(p),
  };
  if (imageBase64) contact.image = { base64String: imageBase64 };
  if (dates.length) contact.dates = dates;
  if (extracted.birthday) {
    contact.birthday = {
      year: extracted.birthday.y,
      month: extracted.birthday.m,
      day: extracted.birthday.d,
    };
  }
  if (extracted.phone) {
    contact.phones = [{ label: 'other', number: extracted.phone }];
  }
  if (extracted.email) {
    contact.emails = [{ label: 'other', address: extracted.email }];
  }

  const created = await Contacts.createContact({ contact });
  return created?.contactId || null;
}

/** Open the iOS Contacts app to a specific contact id. No-op outside iOS. */
export async function openIOSContact(contactId: string): Promise<void> {
  if (!isNativeIOS()) return;
  window.location.href = `contacts://${contactId}`;
}
