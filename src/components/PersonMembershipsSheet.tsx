import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { MembershipChips } from '@/components/MembershipChips';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { useCircles, useEvents } from '@/hooks/use-data';
import { setPersonCircles, setPersonEvents } from '@/lib/store';
import { haptics } from '@/lib/haptics';
import { friendlyError } from '@/lib/errors';

interface PersonMembershipsSheetProps {
  open: boolean;
  personId: string;
  /** The person's current circle ids — used to seed the toggle state. */
  initialCircleIds: string[];
  /** The person's current event ids — used to seed the toggle state. */
  initialEventIds: string[];
  onClose: () => void;
}

/**
 * Bottom sheet for editing a person's circle / event memberships without
 * leaving the read-only profile page. Same toggle-chip pattern the
 * import review uses; just persists straight to setPersonCircles /
 * setPersonEvents instead of deferring until a promote.
 */
export function PersonMembershipsSheet({
  open,
  personId,
  initialCircleIds,
  initialEventIds,
  onClose,
}: PersonMembershipsSheetProps) {
  useScrollLock(open);
  const qc = useQueryClient();
  const { data: circles = [] } = useCircles();
  const { data: events = [] } = useEvents({ includeArchived: false });
  const [circleIds, setCircleIds] = useState<string[]>(initialCircleIds);
  const [eventIds, setEventIds] = useState<string[]>(initialEventIds);
  const [saving, setSaving] = useState(false);

  // Reset when the sheet re-opens or the source person changes — without
  // this, a previously-opened sheet keeps stale toggles.
  useEffect(() => {
    if (open) {
      setCircleIds(initialCircleIds);
      setEventIds(initialEventIds);
    }
  }, [open, initialCircleIds, initialEventIds]);

  const dirty =
    JSON.stringify(circleIds.slice().sort()) !== JSON.stringify(initialCircleIds.slice().sort()) ||
    JSON.stringify(eventIds.slice().sort()) !== JSON.stringify(initialEventIds.slice().sort());

  const handleSave = async () => {
    haptics.medium();
    setSaving(true);
    try {
      // Always send both lists even if one didn't change — the join
      // table sets are idempotent and this keeps the surface trivial.
      await Promise.all([
        setPersonCircles(personId, circleIds),
        setPersonEvents(personId, eventIds),
      ]);
      qc.invalidateQueries({ queryKey: ['person_circles'] });
      qc.invalidateQueries({ queryKey: ['person_events'] });
      qc.invalidateQueries({ queryKey: ['persons', personId] });
      onClose();
    } catch (e) {
      toast.error(friendlyError(e, 'Could not update memberships.'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/70"
        onClick={saving ? undefined : onClose}
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
          <h2 className="text-xl font-display text-foreground tracking-[-0.02em]">
            Circles & Events
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[hsl(var(--foreground)/0.55)] disabled:opacity-50"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <MembershipChips
            circles={circles}
            events={events}
            selectedCircleIds={circleIds}
            selectedEventIds={eventIds}
            onCircleChange={setCircleIds}
            onEventChange={setEventIds}
            emptyMessage="No Circles or Events yet. Create one from the Network tab."
          />
        </div>
        <div className="px-5 py-3 border-t border-[hsl(0_0%_100%/0.08)] safe-bottom">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'No changes'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
