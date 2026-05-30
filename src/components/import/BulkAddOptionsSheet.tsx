import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, X } from 'lucide-react';
import { MembershipChips } from '@/components/MembershipChips';
import { CircleSheet } from '@/components/CircleSheet';
import { EventSheet } from '@/components/EventSheet';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { useCircles, useEvents } from '@/hooks/use-data';

interface BulkAddOptionsSheetProps {
  open: boolean;
  candidateCount: number;
  busy?: boolean;
  /** When true the sheet is acting on a hand-picked subset (select mode)
   *  rather than the whole visible list. Only changes copy — "Add all N"
   *  becomes "Add N selected" so the user knows the scope of the action. */
  subset?: boolean;
  onClose: () => void;
  onConfirm: (opts: { circleIds: string[]; eventIds: string[] }) => void;
}

/**
 * Sheet that confirms a bulk-add from the import review and optionally
 * applies a set of circles / events to every Person being added or merged.
 * No fields are required; tapping the red CTA without selecting anything
 * is the same as the prior "Add all N" behavior.
 */
export function BulkAddOptionsSheet({
  open,
  candidateCount,
  busy,
  subset,
  onClose,
  onConfirm,
}: BulkAddOptionsSheetProps) {
  useScrollLock(open);
  const { data: circles = [] } = useCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const [circleIds, setCircleIds] = useState<string[]>([]);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [createCircleOpen, setCreateCircleOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/70"
        onClick={busy ? undefined : onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 360 }}
        className="glass-sheet fixed left-0 right-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl z-[71] flex flex-col"
        style={{ maxHeight: '85vh', background: 'rgba(20, 14, 14, 0.92)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(0_0%_100%/0.08)]">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--foreground)/0.55)] font-semibold">
              {subset ? 'Add selected' : 'Add all'}
            </div>
            <h2 className="text-xl font-display text-foreground tracking-[-0.02em]">
              {candidateCount} {candidateCount === 1 ? 'person' : 'people'} to People
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[hsl(var(--foreground)/0.55)] disabled:opacity-50"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-5 space-y-3">
          <p className="text-[12px] text-[hsl(var(--foreground)/0.6)] leading-snug">
            Optional — drop everyone into circles or events as part of the add.
            Matches against existing People still merge into their existing entry;
            the selected memberships get added on top of whatever they already have.
          </p>
          <MembershipChips
            circles={circles}
            events={events}
            selectedCircleIds={circleIds}
            selectedEventIds={eventIds}
            onCircleChange={setCircleIds}
            onEventChange={setEventIds}
            emptyMessage="No Circles or Events yet — create your first one below."
          />
          <div className="flex flex-wrap gap-2 pt-1">
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
        </div>
        <div className="px-5 py-3 border-t border-[hsl(0_0%_100%/0.08)] safe-bottom flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="glass-pill h-12 px-4 inline-flex items-center justify-center text-[13px] text-[hsl(var(--foreground)/0.75)] active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ circleIds, eventIds })}
            disabled={busy}
            className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2} />}
            {busy ? 'Adding…' : subset ? `Add ${candidateCount} selected` : `Add all ${candidateCount}`}
          </button>
        </div>
      </motion.div>

      {/* Portal the create sheets to <body> at z-80 so they stack ABOVE
          this bulk sheet (z-71) — otherwise the bulk sheet sits on top and
          the keyboard covers the create sheet's name input. Portaling also
          frees their position:fixed from this transformed motion.div. */}
      {createCircleOpen && createPortal(
        <div className="relative z-[80]">
          <CircleSheet
            onClose={(result) => {
              setCreateCircleOpen(false);
              // Auto-select the newly created circle in the bulk picker
              // so the user doesn't have to find and tap it again after
              // dismissing the create sheet.
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
          <EventSheet onClose={() => setCreateEventOpen(false)} />
        </div>,
        document.body,
      )}
    </AnimatePresence>
  );
}
