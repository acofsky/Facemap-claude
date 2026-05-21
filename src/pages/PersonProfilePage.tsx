import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  usePerson, usePersons, useCircles, useEvents, useConnections, useDeletePerson,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { PhotoImg } from '@/components/PhotoImg';
import { MeetingsSection } from '@/components/MeetingsSection';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { AIBadge } from '@/components/AIBadge';
import { BulletDisplay } from '@/components/BulletTextarea';
import { ContactLinkSection } from '@/components/ContactLinkSection';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InfoModal } from '@/components/InfoModal';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonHeaderSkeleton, PersonRowSkeleton } from '@/components/skeletons';
import { PersonEditPage } from '@/pages/PersonEditPage';
import {
  ArrowLeft, CalendarPlus, Info, Loader2, MapPin, Pencil, Sparkles, Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { isValidTone } from '@/lib/store';
import { friendlyError } from '@/lib/errors';
import { useSwipeBack } from '@/hooks/use-swipe-back';

interface PersonProfilePageProps {
  personId: string;
  onBack: () => void;
  onSelectPerson?: (id: string) => void;
}

/**
 * PEOPLE-02 — Person Detail. Read-only display surface; the pencil icon
 * routes to PersonEditPage (PEOPLE-03) for all editing.
 */
export function PersonProfilePage({ personId, onBack, onSelectPerson }: PersonProfilePageProps) {
  const { data: person, isLoading } = usePerson(personId);
  const { data: allPeople = [] } = usePersons();
  const { data: circles = [] } = useCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const { data: connections = [] } = useConnections();

  const [briefOpen, setBriefOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletePersonMut = useDeletePerson();

  const personConnections = useMemo(
    () => connections.filter((c) => c.person_a_id === personId || c.person_b_id === personId),
    [connections, personId],
  );

  // Swipe gesture is mounted before any early returns so hook order is stable.
  const swipe = useSwipeBack(onBack, { disabled: editOpen });

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await deletePersonMut.mutateAsync(personId);
      // Leave the dialog open until the mutation resolves so the user sees
      // the in-dialog spinner instead of an inert frozen screen.
      setDeleteConfirmOpen(false);
      onBack();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not remove this person. Try again.'));
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // If the person vanishes after load (just deleted), bounce out instead
  // of flashing a "not found" state.
  useEffect(() => {
    if (!isLoading && !person) onBack();
  }, [isLoading, person, onBack]);

  if (isLoading) {
    return <PersonProfileSkeleton />;
  }

  if (!person) {
    return null;
  }

  const personCircleObjects = circles.filter((c) => (person.circleIds || []).includes(c.id));
  const personEventObjects = events.filter((e) => (person.eventIds || []).includes(e.id));
  const firstName = (person.name || '').split(' ')[0] || 'Person';
  const iosContactId = person.ios_contact_id ?? null;

  if (editOpen) {
    return (
      <PersonEditPage
        personId={personId}
        onClose={(result) => {
          setEditOpen(false);
          if (result?.deleted) onBack();
        }}
      />
    );
  }

  return (
    <div
      className="pb-10 animate-fade-in safe-top"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
        touchAction: 'pan-y',
      }}
      {...swipe.bind}
    >
      {/* Nav bar — sticky just below the notch cover */}
      <div
        className="sticky z-20 bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <h1 className="font-sans text-[17px] font-semibold text-foreground truncate px-2">{firstName}</h1>
        <button
          onClick={() => setEditOpen(true)}
          aria-label="Edit person"
          className="w-10 h-10 -mr-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          <Pencil className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Hero block */}
      <div className="flex flex-col items-center px-5 pt-3 pb-5">
        <div className="rounded-full ring-2 ring-primary p-1 mb-3">
          <PersonAvatar name={person.name} photo={person.photos[0]} size="lg" className="!w-24 !h-24 !text-2xl" />
        </div>
        <div className="text-[20px] font-sans font-bold text-foreground text-center leading-tight tracking-[-0.01em]">
          {person.name || 'Unknown'}
        </div>

        {personEventObjects.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2.5 px-4">
            {personEventObjects.map((e) => {
              const tone = isValidTone(e.tone) ? e.tone : 'red';
              return (
                <span
                  key={e.id}
                  className={cn('inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] font-medium text-white/95', `tile-${tone}`)}
                  style={{ borderColor: 'hsl(0 0% 100% / 0.18)' }}
                >
                  {e.name}
                </span>
              );
            })}
          </div>
        )}

        {(person.how_we_met || person.where_when) && (
          <div className="text-center mt-3 space-y-0.5 max-w-xs">
            {person.how_we_met && (
              <p className="text-[13px] text-muted-text italic leading-snug">{person.how_we_met}</p>
            )}
            {person.where_when && (
              <p className="text-[13px] text-muted-text inline-flex items-center gap-1 leading-snug">
                <MapPin className="w-3 h-3" strokeWidth={1.75} /> {person.where_when}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons row. The third tile used to be "Contact" but iOS
          doesn't expose a public URL scheme that opens Contacts.app to a
          specific contact — the link did nothing. The iPhone Contact
          section below already surfaces the linked state. */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-2 gap-2">
          <ActionTile
            icon={CalendarPlus}
            label="Log"
            onClick={() => document.getElementById('encounters-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />
          <ActionTile icon={Sparkles} label="Brief" onClick={() => setBriefOpen(true)} />
        </div>
      </div>

      {/* iPhone Contact — sits directly below the action buttons so it's
          visible without scrolling. The (i) opens a quick explainer. */}
      <div className="px-5 mb-3 flex items-center gap-1.5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">
          iPhone Contact
        </h2>
        <button
          onClick={() => setContactInfoOpen(true)}
          aria-label="How iPhone Contact linking works"
          className="text-muted-text active:scale-90 transition-transform"
        >
          <Info className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <div className="px-5 mb-6">
        <ContactLinkSection
          personId={personId}
          person={person}
          iosContactId={iosContactId}
        />
      </div>

      {/* Photos strip */}
      {person.photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 px-5 scrollbar-hide">
          {person.photos.map((photo, i) => (
            <PhotoImg key={i} path={photo} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          ))}
        </div>
      )}

      {/* About */}
      <SectionLabel>About</SectionLabel>
      <div className="px-5 mb-6">
        {person.misc_notes ? (
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
            <BulletDisplay value={person.misc_notes} />
          </div>
        ) : (
          <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4 text-[14px] text-muted-text italic">
            No notes yet. Tap Edit to add some.
          </div>
        )}
      </div>

      {/* Physical description / Background / Who they know — always
          inline, no collapsible wrapper. Each card only renders if the
          field has content. AI badge only shows when the description
          was generated by describe-from-photo and untouched since. */}
      {(person.physical_description || person.important_info || person.known_people_notes) && (
        <div className="px-5 mb-6 space-y-3">
          {person.physical_description && (
            <DetailCard
              label="Physical description"
              right={person.physical_description_ai_generated ? <AIBadge feature="description" /> : undefined}
            >
              <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{person.physical_description}</p>
            </DetailCard>
          )}
          {person.important_info && (
            <DetailCard label="Background">
              <BulletDisplay value={person.important_info} />
            </DetailCard>
          )}
          {person.known_people_notes && (
            <DetailCard label="Who they know">
              <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{person.known_people_notes}</p>
            </DetailCard>
          )}
        </div>
      )}

      {/* Connections — read-only list of linked people */}
      {personConnections.length > 0 && onSelectPerson && (
        <>
          <SectionLabel>Who they know</SectionLabel>
          <div className="px-5 mb-6 space-y-2">
            {personConnections.map((conn) => {
              const otherId = conn.person_a_id === personId ? conn.person_b_id : conn.person_a_id;
              const other = allPeople.find((p) => p.id === otherId);
              if (!other) return null;
              return (
                <button
                  key={conn.id}
                  onClick={() => onSelectPerson(other.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] hover:border-[hsl(0_0%_100%/0.14)] transition-colors text-left"
                >
                  <PersonAvatar name={other.name} photo={other.photos[0]} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-foreground truncate">{other.name}</div>
                    {conn.note && <div className="text-[12px] text-muted-text truncate">{conn.note}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Circles — kept at the bottom (above Encounters) to mirror the
          edit screen's field order. */}
      {personCircleObjects.length > 0 && (
        <>
          <SectionLabel>Circles</SectionLabel>
          <div className="px-5 mb-6">
            <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4 flex flex-wrap gap-1.5">
              {personCircleObjects.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-sm bg-[hsl(0_0%_100%/0.05)] border border-[hsl(0_0%_100%/0.08)] text-[12px] font-medium text-foreground/80"
                >
                  {c.emoji ? `${c.emoji} ` : ''}{c.name}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Encounters */}
      <div id="encounters-anchor" />
      <SectionLabel>Encounters</SectionLabel>
      <div className="px-5 mb-6">
        <MeetingsSection personId={personId} />
      </div>

      {/* Details */}
      <SectionLabel>Details</SectionLabel>
      <div className="px-5">
        <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted-text">Added</span>
            <span className="text-foreground">{formatDistanceToNow(new Date(person.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* Remove from Membr — always visible here, no need to enter Edit */}
      <div className="px-5 mt-6">
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={deleting}
          className="w-full h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-destructive hover:border-destructive/40 transition-colors inline-flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={1.75} />}
          {deleting ? 'Removing…' : 'Remove from Membr'}
        </button>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Remove from Membr?"
        description={`This deletes ${person.name || 'this person'} along with their encounters, circle memberships, and connections. This cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        loading={deleting}
        loadingLabel="Removing"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <InfoModal
        open={contactInfoOpen}
        title="iPhone Contact"
        onClose={() => setContactInfoOpen(false)}
      >
        <p>
          Linking ties this person to a card in your iPhone's Contacts app. You can
          link an existing contact or create a new one.
        </p>
        <p>
          When you create one, Membr fills in their name and photo, and scans your
          notes for a phone number, email, or birthday to add too.
        </p>
        <p>
          It's a one-time export — editing this profile later won't change the
          contact, and unlinking never deletes anything from Contacts.
        </p>
      </InfoModal>

      <AnimatePresence>
        {briefOpen && (
          <MeetingBriefModal personId={personId} personName={person.name || 'Person'} onClose={() => setBriefOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 mb-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text">{children}</h2>
    </div>
  );
}

function DetailCard({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-surface-1 border border-[hsl(0_0%_100%/0.08)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-text">{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function PersonProfileSkeleton() {
  return (
    <div className="pb-10 safe-top animate-fade-in">
      <div
        className="sticky z-20 bg-background flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)]"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <div className="w-10 h-10" />
        <Skeleton className="h-4 w-24 bg-[hsl(0_0%_100%/0.06)]" />
        <div className="w-10 h-10" />
      </div>
      <PersonHeaderSkeleton />
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-[64px] rounded-md bg-[hsl(0_0%_100%/0.06)]" />
          <Skeleton className="h-[64px] rounded-md bg-[hsl(0_0%_100%/0.06)]" />
          <Skeleton className="h-[64px] rounded-md bg-[hsl(0_0%_100%/0.06)]" />
        </div>
      </div>
      <div className="px-5 mb-3">
        <Skeleton className="h-3 w-12 bg-[hsl(0_0%_100%/0.04)]" />
      </div>
      <div className="px-5 mb-6">
        <Skeleton className="h-24 rounded-lg bg-[hsl(0_0%_100%/0.06)]" />
      </div>
      <div className="px-5 mb-3">
        <Skeleton className="h-3 w-20 bg-[hsl(0_0%_100%/0.04)]" />
      </div>
      <div className="px-5 space-y-2">
        <PersonRowSkeleton />
        <PersonRowSkeleton />
      </div>
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-1 h-[64px] rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-foreground transition-colors active:scale-[0.98]',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:border-[hsl(0_0%_100%/0.2)] active:bg-primary active:text-primary-foreground',
      )}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  );
}
