import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  usePerson, usePersons, useCircles, useEvents, useConnections,
} from '@/hooks/use-data';
import { PersonAvatar } from '@/components/PersonAvatar';
import { PhotoImg } from '@/components/PhotoImg';
import { MeetingsSection } from '@/components/MeetingsSection';
import { MeetingBriefModal } from '@/components/MeetingBriefModal';
import { AIBadge } from '@/components/AIBadge';
import { BulletDisplay } from '@/components/BulletTextarea';
import { PersonEditPage } from '@/pages/PersonEditPage';
import {
  ArrowLeft, CalendarPlus, ChevronDown, ChevronUp, MapPin, Pencil, Phone, Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { isValidTone } from '@/lib/store';
import { isNativeIOS, openIOSContact } from '@/lib/ios-contacts';
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
  const [showOther, setShowOther] = useState(false);

  const personConnections = useMemo(
    () => connections.filter((c) => c.person_a_id === personId || c.person_b_id === personId),
    [connections, personId],
  );

  // Swipe gesture is mounted before any early returns so hook order is stable.
  const swipe = useSwipeBack(onBack, { disabled: editOpen });

  if (isLoading || !person) {
    return (
      <div className="flex items-center justify-center pt-32 safe-top">
        <div className="text-sm text-muted-text">Loading…</div>
      </div>
    );
  }

  const personCircleObjects = circles.filter((c) => (person.circleIds || []).includes(c.id));
  const personEventObjects = events.filter((e) => (person.eventIds || []).includes(e.id));
  const firstName = (person.name || '').split(' ')[0] || 'Person';
  const iosContactId = person.ios_contact_id ?? null;
  const native = isNativeIOS();

  const hasOtherDetails = Boolean(
    person.physical_description || person.important_info || person.known_people_notes,
  );

  if (editOpen) {
    return <PersonEditPage personId={personId} onClose={() => setEditOpen(false)} />;
  }

  return (
    <div
      className="pb-10 animate-fade-in safe-top"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
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

        {(personCircleObjects.length > 0 || personEventObjects.length > 0) && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2.5 px-4">
            {personCircleObjects.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center px-2 py-0.5 rounded-sm bg-[hsl(0_0%_100%/0.05)] border border-[hsl(0_0%_100%/0.08)] text-[11px] font-medium text-foreground/80"
              >
                {c.emoji ? `${c.emoji} ` : ''}{c.name}
              </span>
            ))}
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

      {/* Action buttons row */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-2">
          <ActionTile
            icon={CalendarPlus}
            label="Log"
            onClick={() => document.getElementById('encounters-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />
          <ActionTile icon={Sparkles} label="Brief" onClick={() => setBriefOpen(true)} />
          <ActionTile
            icon={Phone}
            label="Contact"
            onClick={() => iosContactId && openIOSContact(iosContactId)}
            disabled={!iosContactId || !native}
          />
        </div>
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

      {/* Other details (physical description, important info, who they know) */}
      {hasOtherDetails && (
        <div className="px-5 mb-6">
          <button
            onClick={() => setShowOther((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-text"
          >
            More details
            {showOther ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showOther && (
            <div className="mt-3 space-y-3 animate-fade-in">
              {person.physical_description && (
                <DetailCard
                  label="Physical description"
                  right={<AIBadge feature="description" />}
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
