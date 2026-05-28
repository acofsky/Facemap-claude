import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { ImportCandidateRow as ImportCandidateRowComponent } from './ImportCandidateRow';
import { ImportCandidateReviewSheet } from './ImportCandidateReviewSheet';
import {
  fetchPendingCandidates,
  dismissCandidate,
} from '@/lib/import/storage';
import { promoteCandidate, mergeCandidateIntoPerson } from '@/lib/import/promote';
import { findMatchesAgainstPeople } from '@/lib/import/dedupe';
import { usePersons } from '@/hooks/use-data';
import type { Person } from '@/lib/store';
import type { ImportCandidateRow, ImportSource } from '@/lib/import/types';

interface PendingImportsSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Standalone drawer for un-promoted, un-dismissed candidates from ANY past
 * import session. Surfaces in PeoplePage so users can finish triaging an
 * import days after the original run.
 */
export function PendingImportsSheet({ open, onClose }: PendingImportsSheetProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<ImportCandidateRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const { data: existingPeople = [] } = usePersons();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchPendingCandidates()
      .then((rows) => setCandidates(rows))
      .catch((e) => toast.error(friendlyError(e, 'Could not load pending imports.')))
      .finally(() => setLoading(false));
  }, [open]);

  const matchMap = useMemo(() => {
    const drafts = candidates.map((c) => ({
      source: c.source as ImportSource,
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
    }));
    const byIndex = findMatchesAgainstPeople(drafts, existingPeople);
    const byId = new Map<string, string>();
    candidates.forEach((c, i) => {
      const pid = byIndex.get(i);
      if (pid) byId.set(c.id, pid);
    });
    return byId;
  }, [candidates, existingPeople]);

  const reviewingCandidate = useMemo(
    () => candidates.find((c) => c.id === reviewingId) || null,
    [candidates, reviewingId],
  );

  const handlePromote = async (c: ImportCandidateRow, overrides?: Partial<Person>) => {
    setBusyId(c.id);
    try {
      await promoteCandidate(c, overrides ? { fieldOverrides: overrides } : undefined);
      setCandidates((cur) => cur.filter((x) => x.id !== c.id));
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setReviewingId((cur) => (cur === c.id ? null : cur));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add that person.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleMerge = async (c: ImportCandidateRow, personId: string) => {
    setBusyId(c.id);
    try {
      await mergeCandidateIntoPerson(c, personId);
      setCandidates((cur) => cur.filter((x) => x.id !== c.id));
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      qc.invalidateQueries({ queryKey: ['persons', personId] });
      setReviewingId((cur) => (cur === c.id ? null : cur));
      toast.success('Merged into existing person.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not merge.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (c: ImportCandidateRow) => {
    setBusyId(c.id);
    try {
      await dismissCandidate(c.id);
      setCandidates((cur) => cur.filter((x) => x.id !== c.id));
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setReviewingId((cur) => (cur === c.id ? null : cur));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not dismiss.'));
    } finally {
      setBusyId(null);
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
        onClick={onClose}
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
            Pending imports
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[hsl(var(--foreground)/0.55)]"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 safe-bottom">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-center text-[13px] font-display-italic text-[hsl(var(--foreground)/0.6)] py-8">
              All caught up.
            </p>
          ) : (
            candidates.map((c) => {
              const matchedId = matchMap.get(c.id);
              return (
                <div key={c.id} className={cn(busyId === c.id && 'opacity-60')}>
                  <ImportCandidateRowComponent
                    candidate={c}
                    matchedPersonId={matchedId}
                    busy={busyId === c.id}
                    onReview={() => setReviewingId(c.id)}
                    onPromote={() => (matchedId ? handleMerge(c, matchedId) : handlePromote(c))}
                    onDismiss={() => handleDismiss(c)}
                  />
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      <ImportCandidateReviewSheet
        candidate={reviewingCandidate}
        matchedPersonId={reviewingCandidate ? matchMap.get(reviewingCandidate.id) : undefined}
        busy={!!reviewingCandidate && busyId === reviewingCandidate.id}
        onClose={() => setReviewingId(null)}
        onPromote={(overrides) => reviewingCandidate && handlePromote(reviewingCandidate, overrides)}
        onMerge={(pid) => reviewingCandidate && handleMerge(reviewingCandidate, pid)}
        onDismiss={() => reviewingCandidate && handleDismiss(reviewingCandidate)}
      />
    </AnimatePresence>
  );
}
