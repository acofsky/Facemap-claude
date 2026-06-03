import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Plus, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { haptics } from '@/lib/haptics';
import type { ImportCandidateRow as ImportCandidate, ImportSource } from '@/lib/import/types';
import type { Person } from '@/lib/store';
import { fetchPendingCandidates, dismissCandidate, dismissSelectedCandidates, dismissAllPending } from '@/lib/import/storage';
import { promoteCandidate, mergeCandidateIntoPerson } from '@/lib/import/promote';
import { findMatchesAgainstPeople } from '@/lib/import/dedupe';
import { usePersons } from '@/hooks/use-data';
import { ImportCandidateRow } from './ImportCandidateRow';
import { ImportCandidateReviewSheet } from './ImportCandidateReviewSheet';
import { BulkAddOptionsSheet } from './BulkAddOptionsSheet';

// Mirror of ImportPage's review threshold: candidates the AI scored at or
// above this are "strong matches" shown up top; the rest sit behind a
// "show more" toggle — the same top-X / drawer split as the in-wizard
// review screen, so reopening pending imports later behaves identically.
const TOP_QUALITY_THRESHOLD = 0.55;

interface PendingImportsSheetProps {
  /** The sheet is always MOUNTED by PeoplePage; this gates visibility, the
   *  scroll lock, and the candidate fetch. Removing it (and the
   *  `if (!open) return null` guard) would leave the sheet stuck open and
   *  the People page scroll permanently locked. */
  open: boolean;
  onClose: () => void;
}

/**
 * Drawer of every still-pending import candidate from past sessions. Lets
 * the user finish triaging — promote, merge, dismiss — without re-running
 * the wizard. Mirrors the in-wizard review screen: strong matches up top,
 * the rest behind a "show more" toggle, plus a multi-select mode for adding
 * a hand-picked subset to a circle/event.
 */
export function PendingImportsSheet({ open, onClose }: PendingImportsSheetProps) {
  const qc = useQueryClient();
  const { data: existingPeople = [] } = usePersons();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<ImportCandidate | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  // Multi-select mode — same UX as the wizard review screen.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // True when the bulk sheet was opened from a subset selection (vs "Add
  // all"), so the confirm handler knows which set to act on.
  const [bulkFromSelection, setBulkFromSelection] = useState(false);
  useScrollLock(open);

  // Fetch (and reset transient UI state) each time the sheet opens. Gating
  // on `open` matters because PeoplePage keeps this component mounted — a
  // bare mount-time fetch would fire once on app load and never refresh.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShowMore(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    fetchPendingCandidates().then((rows) => {
      setCandidates(rows);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open]);

  const aliveCandidates = useMemo(
    () => candidates.filter((c) => !c.promoted && !c.dismissed),
    [candidates],
  );

  const matchMap = useMemo(() => {
    const draftsForMatch = aliveCandidates.map((c) => ({
      source: c.source as ImportSource,
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
    }));
    const byIndex = findMatchesAgainstPeople(draftsForMatch, existingPeople);
    const byId = new Map<string, string>();
    aliveCandidates.forEach((c, i) => {
      const pid = byIndex.get(i);
      if (pid) byId.set(c.id, pid);
    });
    return byId;
  }, [aliveCandidates, existingPeople]);

  // Top-X / drawer split. Candidates arrive sorted by score desc. Strong =
  // cleared the quality bar; the rest sit behind "show more". If nothing
  // cleared the bar (e.g. all from no-filter sessions), don't bury
  // everything — show the whole list as primary so the sheet isn't empty.
  const { primary, secondary } = useMemo(() => {
    const strong = aliveCandidates.filter(
      (c) => (c.ai_relevance_score ?? 0) >= TOP_QUALITY_THRESHOLD,
    );
    if (strong.length === 0) return { primary: aliveCandidates, secondary: [] as ImportCandidate[] };
    const rest = aliveCandidates.filter(
      (c) => (c.ai_relevance_score ?? 0) < TOP_QUALITY_THRESHOLD,
    );
    return { primary: strong, secondary: rest };
  }, [aliveCandidates]);

  const allSelected = aliveCandidates.length > 0 && selectedIds.size === aliveCandidates.length;

  const handlePromote = async (
    c: ImportCandidate,
    payload?: { fields?: Partial<Person>; circleIds?: string[]; eventIds?: string[] },
  ) => {
    setBusyId(c.id);
    try {
      await promoteCandidate(c, payload ? {
        fieldOverrides: payload.fields,
        circleIds: payload.circleIds,
        eventIds: payload.eventIds,
      } : undefined);
      setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, promoted: true } : x)));
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['person_circles'] });
      qc.invalidateQueries({ queryKey: ['person_events'] });
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setReviewing((cur) => (cur?.id === c.id ? null : cur));
    } catch {
      toast.error('Could not add that person.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMerge = async (c: ImportCandidate, personId: string) => {
    setBusyId(c.id);
    try {
      await mergeCandidateIntoPerson(c, personId);
      setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, promoted: true } : x)));
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['person_circles'] });
      qc.invalidateQueries({ queryKey: ['person_events'] });
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setReviewing((cur) => (cur?.id === c.id ? null : cur));
    } catch {
      toast.error('Could not merge.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (c: ImportCandidate) => {
    setBusyId(c.id);
    try {
      await dismissCandidate(c.id);
      setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, dismissed: true } : x)));
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setReviewing((cur) => (cur?.id === c.id ? null : cur));
    } catch {
      toast.error('Could not dismiss.');
    } finally {
      setBusyId(null);
    }
  };

  // Core bulk-add over a specific target set, optionally dropping everyone
  // into the given circles/events. Shared by "Add all" and subset adds.
  const runBulkAdd = async (
    targets: ImportCandidate[],
    opts: { circleIds: string[]; eventIds: string[] },
  ) => {
    if (targets.length === 0) return;
    haptics.medium();
    setBulkBusy(true);
    let promoted = 0;
    let merged = 0;
    let failed = 0;
    for (const c of targets) {
      try {
        const matchedId = matchMap.get(c.id);
        if (matchedId) {
          await mergeCandidateIntoPerson(c, matchedId, {
            circleIds: opts.circleIds,
            eventIds: opts.eventIds,
          });
          merged++;
        } else {
          await promoteCandidate(c, {
            circleIds: opts.circleIds,
            eventIds: opts.eventIds,
          });
          promoted++;
        }
        setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, promoted: true } : x)));
      } catch (e) {
        console.error('Bulk add failed for', c.id, e);
        failed++;
      }
    }
    setBulkBusy(false);
    qc.invalidateQueries({ queryKey: ['persons'] });
    qc.invalidateQueries({ queryKey: ['person_circles'] });
    qc.invalidateQueries({ queryKey: ['person_events'] });
    qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
    const parts: string[] = [];
    if (promoted) parts.push(`${promoted} added`);
    if (merged) parts.push(`${merged} merged`);
    if (failed) parts.push(`${failed} failed`);
    toast.success(parts.join(' · ') || 'Done');
  };

  const handleBulkConfirm = async (opts: { circleIds: string[]; eventIds: string[] }) => {
    if (bulkFromSelection) {
      const targets = aliveCandidates.filter((c) => selectedIds.has(c.id));
      await runBulkAdd(targets, opts);
      setBulkOpen(false);
      setBulkFromSelection(false);
      // Clear the picked set but stay in select mode for the next batch.
      setSelectedIds(new Set());
    } else {
      await runBulkAdd(aliveCandidates, opts);
      setBulkOpen(false);
      setBulkFromSelection(false);
    }
  };

  // Dismiss just the checked rows, then clear the selection but stay in
  // select mode so the user can keep triaging the next batch.
  const handleDismissSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    haptics.medium();
    setBulkBusy(true);
    try {
      await dismissSelectedCandidates(ids);
      const idSet = new Set(ids);
      setCandidates((cur) => cur.map((x) => (idSet.has(x.id) ? { ...x, dismissed: true } : x)));
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} dismissed`);
    } catch {
      toast.error('Could not dismiss.');
    } finally {
      setBulkBusy(false);
    }
  };

  // "Clear all" — dismiss every still-pending candidate in the drawer.
  const handleClearAll = async () => {
    const shownCount = aliveCandidates.length;
    if (shownCount === 0) return;
    if (!confirm(`Clear all ${shownCount} pending imports? They won't be added to People. You can re-run the import later to get them back.`)) {
      return;
    }
    haptics.medium();
    setBulkBusy(true);
    try {
      // Single bulk UPDATE scoped by RLS — clears EVERY pending row, not
      // just the ones loaded in the sheet, and needs no id list (so it can't
      // hit the giant-URL failure that the old dismissSelectedCandidates path
      // did at 1k+ rows). This is what actually makes Clear All work for a
      // large import.
      const cleared = await dismissAllPending();
      setCandidates((cur) => cur.map((x) => ({ ...x, dismissed: true })));
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setSelectedIds(new Set());
      setSelectMode(false);
      toast.success(`${cleared} cleared`);
    } catch {
      toast.error('Could not clear imports.');
    } finally {
      setBulkBusy(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectMode = () => {
    haptics.selection();
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    haptics.selection();
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const renderRow = (c: ImportCandidate) => {
    const matchedId = matchMap.get(c.id);
    return (
      <div key={c.id} className={busyId === c.id ? 'opacity-60' : ''}>
        <ImportCandidateRow
          candidate={c}
          matchedPersonId={matchedId}
          busy={busyId === c.id}
          onReview={() => setReviewing(c)}
          onPromote={() => (matchedId ? handleMerge(c, matchedId) : handlePromote(c))}
          onDismiss={() => handleDismiss(c)}
          selectMode={selectMode}
          selected={selectedIds.has(c.id)}
          onToggleSelect={() => toggleSelect(c.id)}
        />
      </div>
    );
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
        className="glass-sheet fixed inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl z-[71] flex flex-col"
        style={{ maxHeight: '85vh', background: 'rgba(20, 14, 14, 0.92)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(0_0%_100%/0.08)]">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--foreground)/0.55)] font-semibold">
              Pending
            </div>
            <h2 className="text-xl font-display text-foreground tracking-[-0.02em]">
              {loading ? 'Loading…' : `${aliveCandidates.length} waiting`}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-md flex items-center justify-center text-[hsl(var(--foreground)/0.55)]"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--foreground)/0.4)]" />
            </div>
          ) : aliveCandidates.length === 0 ? (
            <div className="glass p-8 text-center">
              <p className="text-sm font-display-italic text-[hsl(var(--foreground)/0.6)]">
                Nothing pending. Imported people live in your People list.
              </p>
            </div>
          ) : (
            <>
              {!selectMode && (
                <div className="flex items-center gap-2 pb-1">
                  <button
                    onClick={() => { setBulkFromSelection(false); setBulkOpen(true); }}
                    disabled={bulkBusy}
                    className="flex-1 glass-pill h-11 inline-flex items-center justify-center gap-1.5 text-[13px] text-foreground active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    <Users className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    Add all {aliveCandidates.length}
                  </button>
                  <button
                    onClick={enterSelectMode}
                    disabled={bulkBusy}
                    className="glass-pill h-11 px-3.5 inline-flex items-center justify-center gap-1.5 text-[13px] text-[hsl(var(--foreground)/0.75)] active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Select
                  </button>
                  <button
                    onClick={handleClearAll}
                    disabled={bulkBusy}
                    aria-label="Clear all pending imports"
                    className="glass-pill h-11 px-3.5 inline-flex items-center justify-center text-[hsl(var(--foreground)/0.6)] active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              )}

              {selectMode && (
                <div className="flex items-center gap-2 pb-1">
                  <button
                    onClick={allSelected
                      ? () => setSelectedIds(new Set())
                      : () => setSelectedIds(new Set(aliveCandidates.map((c) => c.id)))}
                    disabled={bulkBusy}
                    className="glass-pill h-11 px-3.5 inline-flex items-center justify-center text-[12px] text-foreground active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                  <div className="flex-1 text-center text-[12px] text-[hsl(var(--foreground)/0.6)]">
                    {selectedIds.size} selected
                  </div>
                  <button
                    onClick={exitSelectMode}
                    disabled={bulkBusy}
                    className="glass-pill h-11 px-3.5 inline-flex items-center justify-center text-[12px] text-[hsl(var(--foreground)/0.75)] active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    Done
                  </button>
                </div>
              )}

              {primary.map(renderRow)}

              {secondary.length > 0 && !showMore && (
                <button
                  onClick={() => setShowMore(true)}
                  className="w-full glass-pill h-11 inline-flex items-center justify-center gap-2 text-[13px] text-foreground active:scale-[0.98] transition-transform"
                >
                  <Users className="w-4 h-4" strokeWidth={1.75} />
                  Show {secondary.length} more
                </button>
              )}

              {showMore && secondary.map(renderRow)}
            </>
          )}
        </div>

        {/* Sticky footer CTA while picking a subset. */}
        {selectMode && selectedIds.size > 0 && (
          <div className="shrink-0 px-5 py-3 border-t border-[hsl(0_0%_100%/0.08)] safe-bottom flex items-center gap-2">
            <button
              onClick={handleDismissSelected}
              disabled={bulkBusy}
              aria-label={`Dismiss ${selectedIds.size} selected`}
              className="h-12 px-4 rounded-2xl glass-pill inline-flex items-center justify-center gap-1.5 text-[13px] text-[hsl(var(--foreground)/0.75)] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              Dismiss
            </button>
            <button
              onClick={() => { setBulkFromSelection(true); setBulkOpen(true); }}
              disabled={bulkBusy}
              className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.25} />}
              {bulkBusy ? 'Adding…' : `Add ${selectedIds.size} to a group`}
            </button>
          </div>
        )}
      </motion.div>

      {reviewing && (
        <ImportCandidateReviewSheet
          candidate={reviewing}
          matchedPersonId={reviewing ? matchMap.get(reviewing.id) : undefined}
          busy={busyId === reviewing.id}
          onClose={() => setReviewing(null)}
          onPromote={(payload) => handlePromote(reviewing, payload)}
          onMerge={(pid) => handleMerge(reviewing, pid)}
          onDismiss={() => handleDismiss(reviewing)}
        />
      )}

      <BulkAddOptionsSheet
        open={bulkOpen}
        candidateCount={bulkFromSelection ? selectedIds.size : aliveCandidates.length}
        subset={bulkFromSelection}
        busy={bulkBusy}
        onClose={() => {
          if (bulkBusy) return;
          setBulkOpen(false);
          setBulkFromSelection(false);
        }}
        onConfirm={handleBulkConfirm}
      />
    </AnimatePresence>
  );
}
