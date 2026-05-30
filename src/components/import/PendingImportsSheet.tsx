import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ImportCandidateRow as ImportCandidateRowComponent } from './ImportCandidateRow';
import { ImportCandidateReviewSheet } from './ImportCandidateReviewSheet';
import {
  fetchPendingCandidates,
  dismissCandidate,
  dismissAllPending,
} from '@/lib/import/storage';
import { InfoModal } from '@/components/InfoModal';
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
  const [bulkBusy, setBulkBusy] = useState<'add' | 'clear' | null>(null);
  const [confirmKind, setConfirmKind] = useState<'add' | 'clear' | null>(null);
  const [resultModal, setResultModal] = useState<{ kind: 'add' | 'clear'; counts: { added: number; merged: number; failed: number; cleared: number } } | null>(null);
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

  const handlePromote = async (
    c: ImportCandidateRow,
    payload?: { fields?: Partial<Person>; circleIds?: string[]; eventIds?: string[] },
  ) => {
    setBusyId(c.id);
    try {
      await promoteCandidate(c, payload ? {
        fieldOverrides: payload.fields,
        circleIds: payload.circleIds,
        eventIds: payload.eventIds,
      } : undefined);
      setCandidates((cur) => cur.filter((x) => x.id !== c.id));
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['person_circles'] });
      qc.invalidateQueries({ queryKey: ['person_events'] });
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

  const handleAddAll = async () => {
    setConfirmKind(null);
    setBulkBusy('add');
    haptics.medium();
    // Parallelize in waves of 6 so a thousand-row bulk add doesn't take
    // forever (used to be one sequential round trip per row). 6 keeps us
    // well under Supabase's connection cap while cutting wall time ~6x.
    const WAVE = 6;
    let added = 0;
    let merged = 0;
    let failed = 0;
    for (let i = 0; i < candidates.length; i += WAVE) {
      const wave = candidates.slice(i, i + WAVE);
      const results = await Promise.allSettled(wave.map(async (c) => {
        const matchedId = matchMap.get(c.id);
        if (matchedId) {
          await mergeCandidateIntoPerson(c, matchedId);
          return 'merged';
        }
        await promoteCandidate(c);
        return 'added';
      }));
      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value === 'added') added++;
          else merged++;
        } else {
          failed++;
        }
      }
    }
    setCandidates([]);
    qc.invalidateQueries({ queryKey: ['persons'] });
    qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
    setBulkBusy(null);
    setResultModal({ kind: 'add', counts: { added, merged, failed, cleared: 0 } });
  };

  const handleClearAll = async () => {
    setConfirmKind(null);
    setBulkBusy('clear');
    haptics.medium();
    try {
      // Single SQL update via RLS, not a 1.5k-row client-side loop.
      const cleared = await dismissAllPending();
      setCandidates([]);
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setResultModal({ kind: 'clear', counts: { added: 0, merged: 0, failed: 0, cleared } });
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't clear pending imports."));
    } finally {
      setBulkBusy(null);
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

        {!loading && candidates.length > 0 && (
          <div className="px-5 pt-3 flex items-center gap-2">
            <button
              onClick={() => setConfirmKind('add')}
              disabled={!!bulkBusy}
              className="flex-1 glass-pill h-10 inline-flex items-center justify-center gap-1.5 text-[12px] text-foreground active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {bulkBusy === 'add' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 text-primary" strokeWidth={2} />}
              {bulkBusy === 'add' ? 'Adding…' : `Add all ${candidates.length}`}
            </button>
            <button
              onClick={() => setConfirmKind('clear')}
              disabled={!!bulkBusy}
              className="glass-pill h-10 px-3.5 inline-flex items-center justify-center gap-1.5 text-[12px] text-[hsl(var(--foreground)/0.75)] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {bulkBusy === 'clear' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />}
              Clear all
            </button>
          </div>
        )}

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
        onPromote={(payload) => reviewingCandidate && handlePromote(reviewingCandidate, payload)}
        onMerge={(pid) => reviewingCandidate && handleMerge(reviewingCandidate, pid)}
        onDismiss={() => reviewingCandidate && handleDismiss(reviewingCandidate)}
      />

      <ConfirmDialog
        open={confirmKind === 'add'}
        title={`Add all ${candidates.length}?`}
        description="Everyone pending will land in your People list. Matches against existing people are merged into their existing entry without overwriting fields."
        confirmLabel="Add all"
        cancelLabel="Not yet"
        onConfirm={handleAddAll}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmDialog
        open={confirmKind === 'clear'}
        title={`Clear all ${candidates.length}?`}
        description="These pending imports will be dismissed. You can re-import them later, but their AI bullets will be regenerated."
        confirmLabel="Clear all"
        cancelLabel="Keep"
        destructive
        loading={bulkBusy === 'clear'}
        loadingLabel="Clearing"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmKind(null)}
      />

      <InfoModal
        open={!!resultModal}
        title={resultModal?.kind === 'clear' ? 'Pending imports cleared' : 'Bulk add complete'}
        onClose={() => setResultModal(null)}
      >
        {resultModal?.kind === 'clear' ? (
          <p>
            <span className="text-foreground">{resultModal.counts.cleared}</span>{' '}
            pending import{resultModal.counts.cleared === 1 ? '' : 's'} dismissed.
            You can re-pull from any source any time.
          </p>
        ) : resultModal ? (
          <>
            {resultModal.counts.added > 0 && (
              <p>
                <span className="text-foreground">{resultModal.counts.added}</span> new{' '}
                {resultModal.counts.added === 1 ? 'person' : 'people'} added.
              </p>
            )}
            {resultModal.counts.merged > 0 && (
              <p>
                <span className="text-foreground">{resultModal.counts.merged}</span>{' '}
                merged into existing People (filled empty fields, didn't overwrite).
              </p>
            )}
            {resultModal.counts.failed > 0 && (
              <p className="text-[hsl(var(--foreground)/0.55)]">
                {resultModal.counts.failed} couldn't be added — likely a network issue. Retry from the pending list if needed.
              </p>
            )}
          </>
        ) : null}
      </InfoModal>
    </AnimatePresence>
  );
}
