import { useState, useMemo } from 'react';
import { Contact2, Link2Off, ExternalLink, UserPlus, Loader2, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  isNativeIOS,
  pickIOSContact,
  createIOSContactFromPerson,
  openIOSContact,
  type PersonForExport,
} from '@/lib/ios-contacts';
import { useUpdatePerson } from '@/hooks/use-data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  personId: string;
  person: PersonForExport;
  iosContactId: string | null;
}

// Mirror the regexes in ios-contacts.ts so we can preview what *would* be detected.
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL_RE = /([\w.+-]+@[\w-]+\.[\w.-]+)/;
const BDAY_RE = /(?:b(?:irth)?day|born)[^a-z0-9]{0,4}([A-Za-z0-9 ,/.\-]{3,30})/i;

function previewExtractions(person: PersonForExport) {
  const blob = [
    person.important_info, person.misc_notes, person.known_people_notes,
    person.physical_description, person.how_we_met, person.where_when,
  ].filter(Boolean).join('\n');
  return {
    phone: blob.match(PHONE_RE)?.[1].trim(),
    email: blob.match(EMAIL_RE)?.[1].trim(),
    birthday: blob.match(BDAY_RE)?.[1].trim(),
  };
}

export function ContactLinkSection({ personId, person, iosContactId }: Props) {
  const updatePerson = useUpdatePerson();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const native = isNativeIOS();

  const items = useMemo(() => {
    const extracted = previewExtractions(person);
    const list: { label: string; detail?: string; smart?: boolean }[] = [];
    list.push({ label: 'Name', detail: person.name });
    if (person.photos?.[0]) list.push({ label: 'Photo' });
    if (person.date_met) list.push({ label: 'Date met', detail: 'as a "Met" date' });
    const noteFields = [
      person.how_we_met && 'how we met',
      person.where_when && 'where',
      person.important_info && 'important info',
      person.misc_notes && 'notes',
      person.known_people_notes && 'who they know',
    ].filter(Boolean) as string[];
    if (noteFields.length) list.push({ label: 'Notes', detail: noteFields.join(', ') });
    if (extracted.birthday) list.push({ label: 'Birthday', detail: `found "${extracted.birthday}"`, smart: true });
    if (extracted.phone) list.push({ label: 'Phone', detail: extracted.phone, smart: true });
    if (extracted.email) list.push({ label: 'Email', detail: extracted.email, smart: true });
    return list;
  }, [person]);

  const handleLink = async () => {
    setBusy(true);
    try {
      const picked = await pickIOSContact();
      if (!picked) return;
      await updatePerson.mutateAsync({ id: personId, updates: { ios_contact_id: picked.id } });
      toast.success(`Linked to ${picked.name}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not link contact');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCreate = async () => {
    setBusy(true);
    try {
      const id = await createIOSContactFromPerson(person);
      if (!id) return;
      await updatePerson.mutateAsync({ id: personId, updates: { ios_contact_id: id } });
      toast.success('Created in iPhone Contacts');
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Could not create contact');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    await updatePerson.mutateAsync({ id: personId, updates: { ios_contact_id: null } });
    toast.success('Unlinked');
  };

  if (iosContactId) {
    return (
      <div className="rounded-xl bg-card p-4 warm-shadow mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Contact2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">iPhone Contact</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openIOSContact(iosContactId)}
            disabled={!native}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" /> Open in Contacts
          </button>
          <button
            onClick={handleUnlink}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm"
          >
            <Link2Off className="w-4 h-4" />
          </button>
        </div>
        {!native && (
          <p className="text-[11px] text-muted-foreground italic mt-2">
            Opens the Contacts app on your iPhone (in the native build).
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl bg-card p-4 warm-shadow mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Contact2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">iPhone Contact</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLink}
            disabled={busy || !native}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Contact2 className="w-4 h-4" />}
            Link existing
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={busy || !native || !person.name}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            Create new
          </button>
        </div>
        {!native && (
          <p className="text-[11px] text-muted-foreground italic mt-2">
            Available in the iPhone app — does nothing in web preview.
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Create iPhone Contact
            </DialogTitle>
            <DialogDescription className="text-xs">
              FaceMap will port what fits cleanly into Contacts — and scan your notes for
              anything iOS can use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 my-2">
            {items.map(it => (
              <div key={it.label} className="flex items-start gap-2 text-sm">
                {it.smart ? (
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                ) : (
                  <Check className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span className="text-foreground font-medium">{it.label}</span>
                  {it.detail && (
                    <span className="text-muted-foreground"> — {it.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            One-time export. Editing this profile later won't change the contact.
          </p>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCreate}
              disabled={busy}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {busy ? 'Creating...' : 'Create contact'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
