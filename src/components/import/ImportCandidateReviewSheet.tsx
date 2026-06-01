import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, Sparkles, Trash2, Users, X } from 'lucide-react';
import { PersonAvatar } from '@/components/PersonAvatar';
import { BulletTextarea } from '@/components/BulletTextarea';
import { MembershipChips } from '@/components/MembershipChips';
import { CircleSheet } from '@/components/CircleSheet';
import { EventSheet } from '@/components/EventSheet';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { useCircles, useEvents } from '@/hooks/use-data';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { sourceLabel } from './sourceLabels';
import { stripOwnName, bulletDuplicatesStructured } from '@/lib/import/promote';
import type { ImportCandidateRow, MappedPersonFields } from '@/lib/import/types';
import type { Person } from '@/lib/store';

export interface PromotePayload {
  fields: Partial<Person>;
  circleIds: string[];
  eventIds: string[];
}

interface ImportCandidateReviewSheetProps {
  candidate: ImportCandidateRow | null;
  matchedPersonId?: string;
  busy?: boolean;
  onClose: () => void;
  onPromote: (payload: PromotePayload) => Promise<void> | void;
  onMerge?: (personId: string) => Promise<void> | void;
  onDismiss: () => void;
}

/**
 * Slide-up sheet for reviewing one imported candidate in full. Renders
 * every person field — populated from the source's mapped data, blank
 * where the source didn't have anything — and lets the user tweak them
 * inline before promoting. Two modes: net-new "Add to People" or, when
 * the candidate matches an existing person via dedupe, "Merge in".
 */
export function ImportCandidateReviewSheet({
  candidate,
  matchedPersonId,
  busy,
  onClose,
  onPromote,
  onMerge,
  onDismiss,
}: ImportCandidateReviewSheetProps) {
  useScrollLock(!!candidate);

  if (!candidate) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[75] bg-black/70"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 360 }}
        className="glass-sheet fixed left-0 right-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl z-[76] flex flex-col"
        style={{ maxHeight: '92vh', background: 'rgba(20, 14, 14, 0.94)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <SheetBody
          candidate={candidate}
          matchedPersonId={matchedPersonId}
          busy={busy}
          onClose={onClose}
          onPromote={onPromote}
          onMerge={onMerge}
          onDismiss={onDismiss}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function SheetBody({
  candidate,
  matchedPersonId,
  busy,
  onClose,
  onPromote,
  onMerge,
  onDismiss,
}: {
  candidate: ImportCandidateRow;
  matchedPersonId?: string;
  busy?: boolean;
  onClose: () => void;
  onPromote: (overrides: Partial<Person>) => Promise<void> | void;
  onMerge?: (personId: string) => Promise<void> | void;
  onDismiss: () => void;
}) {
  const mapped = useMemo(
    () => ((candidate.raw as { mapped_fields?: MappedPersonFields } | null)?.mapped_fields || {}),
    [candidate],
  );
  // Initial values: mapped column → field, or AI bullets for the About
  // field when there were no mapped notes. Everything is editable.
  const initialAbout = useMemo(() => {
    if (mapped.misc_notes) return mapped.misc_notes;
    // Strip any leading self-name the model slipped into a bullet so the
    // editable About doesn't show "[their own name] at [firm]", and drop
    // bullets that merely restate the company/title shown in Background.
    const bullets = ((candidate.ai_bullets as string[] | null) || [])
      .map((b) => stripOwnName(b, candidate.name))
      .filter(Boolean)
      .filter((b) => !bulletDuplicatesStructured(b, candidate));
    return bullets.join('\n');
  }, [candidate, mapped.misc_notes]);
  const initialBackground = useMemo(() => {
    if (mapped.important_info) return mapped.important_info;
    const lines: string[] = [];
    if (candidate.title || candidate.company) {
      lines.push([candidate.title, candidate.company].filter(Boolean).join(' at '));
    }
    if (candidate.email) lines.push(`Email: ${candidate.email}`);
    if (candidate.phone) lines.push(`Phone: ${candidate.phone}`);
    return lines.join('\n');
  }, [candidate, mapped.important_info]);

  const [name, setName] = useState(candidate.name);
  const [howWeMet, setHowWeMet] = useState(mapped.how_we_met || '');
  const [whereWhen, setWhereWhen] = useState(mapped.where_when || '');
  const [dateMet, setDateMet] = useState('');
  const [about, setAbout] = useState(initialAbout);
  const [background, setBackground] = useState(initialBackground);
  const [physical, setPhysical] = useState(mapped.physical_description || '');
  const [known, setKnown] = useState(mapped.known_people_notes || '');
  const [circleIds, setCircleIds] = useState<string[]>([]);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [createCircleOpen, setCreateCircleOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);

  const { data: circles = [] } = useCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });

  const handlePromote = () => {
    haptics.medium();
    const aboutTrimmed = about.trim();
    const aboutWithProvenance = appendProvenanceBullet(
      aboutTrimmed,
      `Imported from ${sourceLabel(candidate.source)}`,
    );
    onPromote({
      fields: {
        name: name.trim() || candidate.name,
        how_we_met: howWeMet.trim() || null,
        where_when: whereWhen.trim() || null,
        date_met: dateMet || null,
        misc_notes: aboutWithProvenance,
        important_info: bulletize(background) || null,
        physical_description: physical.trim() || null,
        known_people_notes: known.trim() || null,
      },
      circleIds,
      eventIds,
    });
  };

  const handleMerge = () => {
    if (!matchedPersonId || !onMerge) return;
    haptics.medium();
    onMerge(matchedPersonId);
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[hsl(0_0%_100%/0.08)]">
        <div className="flex items-center gap-3 min-w-0">
          <PersonAvatar
            name={name || candidate.name}
            photo={candidate.photo_path || undefined}
            size="sm"
          />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--foreground)/0.55)] font-semibold">
              Review import
            </div>
            <div className="font-display text-[17px] text-foreground truncate">
              From {sourceLabel(candidate.source)}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 rounded-md flex items-center justify-center text-[hsl(var(--foreground)/0.55)]"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      {matchedPersonId && (
        <div className="mx-5 mt-3 mb-1 glass-warm p-2.5 flex items-center gap-2 text-[12px] text-foreground">
          <Users className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
          <span>This name matches someone already in your People — merging will fill any empty fields without overwriting yours.</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-3 pb-5 space-y-4">
        {candidate.ai_rationale && (
          <div className="flex items-start gap-2 text-[12px] text-[hsl(var(--foreground)/0.65)] leading-snug">
            <Sparkles className="w-3 h-3 mt-0.5 shrink-0 text-primary" strokeWidth={1.75} />
            <span className="font-display-italic">{candidate.ai_rationale}</span>
          </div>
        )}

        <FieldLabel label="Name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full h-11 px-3.5 text-sm"
            placeholder="Their name"
          />
        </FieldLabel>

        <FieldLabel label="How we met">
          <textarea
            value={howWeMet}
            onChange={(e) => setHowWeMet(e.target.value)}
            placeholder={mapped.how_we_met ? '' : 'Empty — fill in if you remember'}
            rows={2}
            className="glass-input w-full px-3.5 py-2.5 text-sm resize-none"
          />
        </FieldLabel>

        <FieldLabel label="Where we met">
          <input
            value={whereWhen}
            onChange={(e) => setWhereWhen(e.target.value)}
            placeholder={mapped.where_when ? '' : 'Empty — fill in if you remember'}
            className="glass-input w-full h-11 px-3.5 text-sm"
          />
        </FieldLabel>

        <FieldLabel label="Date met">
          <input
            type="date"
            value={dateMet}
            onChange={(e) => setDateMet(e.target.value)}
            // appearance-none + block + min-w-0 keep iOS WebKit's native
            // date widget from punching out of the container's width and
            // creating a phantom horizontal scrollbar on the form. Using
            // padding (py-3) rather than a fixed h-11 lets the date text
            // sit vertically centered inside the box — iOS's native
            // date input ignores line-height so a fixed-height container
            // pinned the text up against the top edge.
            className="glass-input block w-full min-w-0 px-3.5 py-3 text-sm appearance-none"
          />
        </FieldLabel>

        <FieldLabel label="About">
          <BulletTextarea value={about} onChange={setAbout} rows={3} placeholder="Empty" />
        </FieldLabel>

        <FieldLabel label="Background">
          <BulletTextarea value={background} onChange={setBackground} rows={3} placeholder="Empty" />
        </FieldLabel>

        <FieldLabel label="Physical description">
          <textarea
            value={physical}
            onChange={(e) => setPhysical(e.target.value)}
            placeholder={mapped.physical_description ? '' : 'Empty — fill in if you remember'}
            rows={2}
            className="glass-input w-full px-3.5 py-2.5 text-sm resize-none"
          />
        </FieldLabel>

        <FieldLabel label="Who they know">
          <textarea
            value={known}
            onChange={(e) => setKnown(e.target.value)}
            placeholder={mapped.known_people_notes ? '' : 'Empty — fill in if you remember'}
            rows={2}
            className="glass-input w-full px-3.5 py-2.5 text-sm resize-none"
          />
        </FieldLabel>

        <FieldLabel label="Circles & Events">
          <p className="text-[11px] text-[hsl(var(--foreground)/0.55)] mb-2 leading-snug">
            Drop them into any existing circles or events, or spin up a new one right here.
          </p>
          {(circles.length > 0 || events.length > 0) && (
            <MembershipChips
              circles={circles}
              events={events}
              selectedCircleIds={circleIds}
              selectedEventIds={eventIds}
              onCircleChange={setCircleIds}
              onEventChange={setEventIds}
              compact
            />
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => setCreateCircleOpen(true)}
              className="glass-pill !h-8 !px-3 text-[12px] text-[hsl(var(--foreground)/0.7)] inline-flex items-center gap-1 active:scale-[0.96] transition-transform"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              New Circle
            </button>
            <button
              type="button"
              onClick={() => setCreateEventOpen(true)}
              className="glass-pill !h-8 !px-3 text-[12px] text-[hsl(var(--foreground)/0.7)] inline-flex items-center gap-1 active:scale-[0.96] transition-transform"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              New Event
            </button>
          </div>
        </FieldLabel>
      </div>

      {/* Portal the create sheets to <body> so their position:fixed
          overlays anchor to the viewport, not to this framer-motion sheet
          (a transformed ancestor would otherwise become their containing
          block and mis-place them). They also need to sit above this
          sheet's z-76, so CircleSheet/EventSheet's own stacking is bumped
          via the wrapper below. */}
      {createCircleOpen && createPortal(
        <div className="relative z-[80]">
          <CircleSheet
            onClose={(result) => {
              setCreateCircleOpen(false);
              // Auto-select the freshly created circle so the user doesn't
              // have to hunt for it after the create sheet dismisses.
              if (result && 'id' in result) {
                setCircleIds((cur) => (cur.includes(result.id) ? cur : [...cur, result.id]));
              }
            }}
          />
        </div>,
        document.body,
      )}
      {createEventOpen && createPortal(
        <div className="relative z-[80]">
          <EventSheet
            onClose={(result) => {
              setCreateEventOpen(false);
              // Auto-select the freshly created event so this person actually
              // lands in it on promote — matches the New Circle pill.
              if (result && 'id' in result) {
                setEventIds((cur) => (cur.includes(result.id) ? cur : [...cur, result.id]));
              }
            }}
          />
        </div>,
        document.body,
      )}

      <div className="px-5 py-3 border-t border-[hsl(0_0%_100%/0.08)] safe-bottom flex items-center gap-2">
        <button
          onClick={onDismiss}
          disabled={busy}
          aria-label="Dismiss"
          className="glass-pill !h-12 !w-12 !p-0 flex items-center justify-center text-[hsl(var(--foreground)/0.55)] active:scale-95 transition-transform disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
        </button>
        {matchedPersonId && onMerge ? (
          <button
            onClick={handleMerge}
            disabled={busy}
            className={cn(
              'flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-50 inline-flex items-center justify-center gap-1.5',
            )}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2} />}
            Merge in
          </button>
        ) : (
          <button
            onClick={handlePromote}
            disabled={busy}
            className={cn(
              'flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-50 inline-flex items-center justify-center gap-1.5',
            )}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2} />}
            Add to People
          </button>
        )}
      </div>
    </>
  );
}

function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--foreground)/0.55)] mb-1.5">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </div>
      {children}
    </div>
  );
}

function bulletize(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');
}

function appendProvenanceBullet(text: string, line: string): string {
  const formatted = bulletize(text);
  const provenance = `• ${line}`;
  if (!formatted) return provenance;
  return `${formatted}\n${provenance}`;
}
