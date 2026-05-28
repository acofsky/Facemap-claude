import { Contacts, type ContactPayload } from '@capacitor-community/contacts';
import { supabase } from '@/integrations/supabase/client';
import { isNativeIOS } from '@/lib/ios-contacts';
import type { CandidateDraft } from '../types';

/**
 * Read every contact the user grants permission to and turn them into
 * CandidateDrafts. Photos (if present) are uploaded to the person-photos
 * bucket under the user's folder so the draft can carry a persistent path.
 */
export async function gatherContactsCandidates(opts?: {
  onProgress?: (loaded: number) => void;
}): Promise<CandidateDraft[]> {
  if (!isNativeIOS()) {
    throw new Error('Contacts import is only available in the iOS app.');
  }
  const perm = await Contacts.requestPermissions();
  if (perm.contacts !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  const result = await Contacts.getContacts({
    projection: {
      name: true,
      phones: true,
      emails: true,
      organization: true,
      image: true,
    },
  });

  const contacts = (result?.contacts || []) as ContactPayload[];
  const drafts: CandidateDraft[] = [];

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const name =
      c.name?.display ||
      [c.name?.given, c.name?.middle, c.name?.family].filter(Boolean).join(' ') ||
      '';
    if (!name.trim()) continue;

    const email = c.emails?.[0]?.address || undefined;
    const phone = c.phones?.[0]?.number || undefined;
    const company = c.organization?.company || undefined;
    const title = c.organization?.jobTitle || undefined;

    let photoPath: string | undefined;
    const b64 = c.image?.base64String;
    if (b64) {
      photoPath = await uploadContactsPhoto(b64).catch(() => undefined);
    }

    drafts.push({
      source: 'contacts',
      name,
      email,
      phone,
      company,
      title,
      photoPath,
      raw: { contact_id: c.contactId },
    });

    if (opts?.onProgress && i % 10 === 0) opts.onProgress(i + 1);
  }

  opts?.onProgress?.(drafts.length);
  return drafts;
}

async function uploadContactsPhoto(base64: string): Promise<string | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;
  const blob = await base64ToBlob(base64, 'image/jpeg');
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('person-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) return undefined;
  return path;
}

async function base64ToBlob(base64: string, contentType: string): Promise<Blob> {
  const res = await fetch(`data:${contentType};base64,${base64}`);
  return res.blob();
}
