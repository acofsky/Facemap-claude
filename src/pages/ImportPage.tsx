import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Calendar, Check, FileText, Files,
  Info, Loader2, Plus, RotateCcw, Sparkles, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useSwipeBack } from '@/hooks/use-swipe-back';
import { usePersons } from '@/hooks/use-data';
import { haptics } from '@/lib/haptics';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { isNativeIOS } from '@/lib/ios-contacts';
import { BulkAddOptionsSheet } from '@/components/import/BulkAddOptionsSheet';
import { ImportCandidateRow as ImportCandidateRowComponent } from '@/components/import/ImportCandidateRow';
import { ImportCandidateReviewSheet } from '@/components/import/ImportCandidateReviewSheet';
import { InfoModal } from '@/components/InfoModal';
import { LinkedInHowToModal } from '@/components/import/LinkedInHowToModal';
import { SpreadsheetHowToModal } from '@/components/import/SpreadsheetHowToModal';
import { RankResultModal } from '@/components/import/RankResultModal';
import { gatherContactsCandidates } from '@/lib/import/sources/contacts-source';
import { parseLinkedInCsv } from '@/lib/import/sources/linkedin-source';
import { gatherFileCandidates, UnsupportedFileError } from '@/lib/import/sources/file-source';
import { SpreadsheetParseError } from '@/lib/import/sources/spreadsheet-source';
import { isCalendarSourceAvailable } from '@/lib/import/sources/calendar-source';
import { mergeDrafts, findMatchesAgainstPeople } from '@/lib/import/dedupe';
import {
  createImportSession,
  insertCandidates,
  fetchSessionCandidates,
  dismissCandidate,
} from '@/lib/import/storage';
import { rankCandidates } from '@/lib/import/rank';
import { promoteCandidate, mergeCandidateIntoPerson } from '@/lib/import/promote';
import type { Person } from '@/lib/store';
import type { CandidateDraft, ImportCandidateRow, ImportSource } from '@/lib/import/types';

const TOP_N_OPTIONS = [5, 10, 20, 50] as const;
type TopN = (typeof TOP_N_OPTIONS)[number];
const DEFAULT_TOP_N: TopN = 20;
/** Candidates scoring below this with a filter set count as "no close matches". */
const NO_MATCH_THRESHOLD = 0.35;
/**
 * When the user gave a real filter, only candidates that the AI scored
 * at or above this threshold qualify for the curated top-N slice. The
 * rest go straight to the "More imports" drawer regardless of how
 * many qualified — so when there are only 7 genuine matches out of
 * 400 contacts, the user sees 7 top-of-list candidates, not 7 strong
 * + 13 weak ones the model just had to dredge up to fill a quota.
 *
 * 0.55 maps to "plausible match" in the system prompt's score bands.
 * Anything below that is "ambiguous / sparse" or "clear non-match,"
 * which the user (correctly) doesn't want surfaced as a "best match".
 */
const TOP_QUALITY_THRESHOLD = 0.55;

// Order: source pick → filter → gather → review. Filter sits up front so the
// user's stated goal is in mind during gather, and the AI rank step runs
// invisibly as the wizard moves into review.
type Step = 'pick' | 'filter' | 'gather' | 'review';

const STEP_ORDER: Step[] = ['pick', 'filter', 'gather', 'review'];

interface ImportPageProps {
  onClose: () => void;
  onSelectPerson?: (id: string) => void;
}

export function ImportPage({ onClose, onSelectPerson: _onSelectPerson }: ImportPageProps) {
  const qc = useQueryClient();
  const { data: existingPeople = [] } = usePersons();

  const [step, setStep] = useState<Step>('pick');
  const [selectedSources, setSelectedSources] = useState<Set<ImportSource>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [topN, setTopN] = useState<TopN>(DEFAULT_TOP_N);
  const [drafts, setDrafts] = useState<CandidateDraft[]>([]);
  const [gathering, setGathering] = useState<ImportSource | null>(null);
  const [gatherProgress, setGatherProgress] = useState(0);
  const [completedSources, setCompletedSources] = useState<Set<ImportSource>>(new Set());
  const [linkedInHowTo, setLinkedInHowTo] = useState(false);
  const [spreadsheetHowTo, setSpreadsheetHowTo] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [candidates, setCandidates] = useState<ImportCandidateRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkOptionsOpen, setBulkOptionsOpen] = useState(false);
  // Multi-select on the review screen: lets the user hand-pick a subset,
  // drop them into a circle/event, then pick another subset for a different
  // one — instead of being forced to send the whole list to a single
  // destination. selectMode toggles the UI; selectedIds is the working set.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // True when the bulk sheet was opened from a subset selection (vs "Add
  // all"), so handleBulkAdd knows which set to act on and the sheet can
  // adapt its copy.
  const [bulkFromSelection, setBulkFromSelection] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [contactsResultModal, setContactsResultModal] = useState<
    { totalRead: number; alreadyKnown: number } | null
  >(null);
  const [rankModal, setRankModal] = useState<{ kind: 'no-matches' } | null>(null);
  // When the AI ranking call itself fails (network blip, edge function
  // timeout, etc) we still show the candidates — but a slim banner on the
  // review page tells the user why their scores look uniform and lets
  // them retry without leaving the screen.
  const [rankFailed, setRankFailed] = useState(false);
  // How many candidates a partial-failure rank pass left UNSCORED (chunk
  // timed out / parse-failed). These keep NULL score and sort to the bottom
  // of the drawer — genuine matches can hide here. Drives a targeted retry
  // banner separate from the total-failure (rankFailed) banner.
  const [unscoredCount, setUnscoredCount] = useState(0);
  // Lets the user click "Browse all anyway" in the no-matches modal so the
  // review screen still renders the (low-scoring) candidates as-is.
  const [showLowScores, setShowLowScores] = useState(false);

  const linkedInRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- back navigation ----

  const goBack = () => {
    haptics.selection();
    const idx = STEP_ORDER.indexOf(step);
    if (idx <= 0) {
      onClose();
      return;
    }
    // Review is a terminal screen: tapping back closes the wizard instead
    // of unwinding through rank/gather/filter (those have side effects).
    if (step === 'review') {
      onClose();
      return;
    }
    setStep(STEP_ORDER[idx - 1]);
  };

  const swipe = useSwipeBack(goBack);

  // ---- step transitions ----

  const goToFilter = () => {
    if (selectedSources.size === 0) return;
    haptics.medium();
    setStep('filter');
  };

  const goToGather = () => {
    haptics.medium();
    setStep('gather');
  };

  const toggleSource = (source: ImportSource) => {
    haptics.selection();
    setSelectedSources((cur) => {
      const next = new Set(cur);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  // ---- gather handlers ----

  const runContacts = async () => {
    setGathering('contacts');
    setGatherProgress(0);
    try {
      // Refresh the auth session before any Supabase calls in the
      // contacts source. iOS WebView can let the access token expire
      // between mount and tap; the contacts source calls Supabase to
      // fetch known IDs and to upload contact photos, and if the
      // first one triggers an internal refresh that fails, gotrue
      // clears the session and bounces the user to the login screen
      // mid-gather. Doing the refresh ourselves up front gives us a
      // clean failure mode — same pattern as handleRankAndReview.
      const { supabase } = await import('@/integrations/supabase/client');
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        setGathering(null);
        return;
      }
      const { drafts: got, stats } = await gatherContactsCandidates({ onProgress: setGatherProgress });
      setDrafts((d) => [...d, ...got]);
      setCompletedSources((s) => new Set(s).add('contacts'));

      // 0 new can happen two ways: nothing in iOS Contacts at all, or
      // everything was already imported in a previous session. Toasts
      // are too easy to miss when there's actual context to convey, so
      // surface this as an InfoModal explaining what happened.
      if (got.length === 0) {
        setContactsResultModal({
          totalRead: stats.totalRead,
          alreadyKnown: stats.alreadyKnown,
        });
      } else {
        const skipNote = stats.alreadyKnown > 0
          ? ` · ${stats.alreadyKnown} already imported`
          : '';
        toast.success(`Pulled ${got.length} contacts${skipNote}`);
      }
    } catch (e) {
      if ((e as Error).message === 'PERMISSION_DENIED') {
        toast.error('Contacts permission denied. Open Settings → Membr → Contacts.');
      } else {
        toast.error(friendlyError(e, 'Could not read Contacts.'));
      }
    } finally {
      setGathering(null);
    }
  };

  const runLinkedInFile = async (file: File) => {
    setGathering('linkedin');
    try {
      const got = await parseLinkedInCsv(file);
      setDrafts((d) => [...d, ...got]);
      setCompletedSources((s) => new Set(s).add('linkedin'));
      toast.success(`Parsed ${got.length} LinkedIn connections`);
    } catch (e) {
      toast.error(friendlyError(e, 'That CSV did not look like a LinkedIn export.'));
    } finally {
      setGathering(null);
    }
  };

  const runFile = async (file: File) => {
    setGathering('spreadsheet');
    try {
      const got = await gatherFileCandidates(file);
      if (got.length === 0) {
        toast.error(
          file.type.startsWith('image/')
            ? "No names visible in that photo. Try one with name badges or a caption."
            : 'No rows with a name found in that file.',
        );
      } else {
        setDrafts((d) => [...d, ...got]);
        toast.success(`Pulled ${got.length} ${got.length === 1 ? 'person' : 'people'} from ${file.name}`);
      }
      setCompletedSources((s) => new Set(s).add('spreadsheet'));
    } catch (e) {
      if (e instanceof UnsupportedFileError || e instanceof SpreadsheetParseError) {
        toast.error(e.message);
      } else {
        toast.error(friendlyError(e, "Couldn't read that file."));
      }
    } finally {
      setGathering(null);
    }
  };

  // ---- rank step (invisible — runs between gather and review) ----

  const handleRankAndReview = async () => {
    if (drafts.length === 0) {
      toast.error('Nothing pulled yet — run at least one source first.');
      return;
    }
    setRanking(true);
    setShowLowScores(false);
    try {
      // Pre-flight token refresh. iOS WebView can let the access token
      // expire while the user reads the previous step; if the very first
      // Supabase call triggers a token refresh that fails, gotrue clears
      // the session and bounces the user to AuthPage with a stale toast
      // still visible. Refreshing here gives us a clean failure mode.
      const { supabase } = await import('@/integrations/supabase/client');
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        // The auth listener in use-auth.tsx will already be sending the
        // user back to login. Swallow our own error path so we don't
        // also throw a confusing toast on top.
        setRanking(false);
        return;
      }
      const merged = mergeDrafts(drafts);
      // If mergeDrafts collapsed near-duplicates from a single source
      // (same name + matching phone/email), surface the collapse so
      // the user understands why the review header count differs from
      // the gather toast.
      const collapsed = drafts.length - merged.length;
      if (collapsed > 0) {
        toast.success(
          `Merging ${collapsed} duplicate${collapsed === 1 ? '' : 's'} — ${merged.length} unique to review`,
        );
      }
      const sourcesUsed = Array.from(selectedSources);
      const session = await createImportSession({ filterText, sources: sourcesUsed });
      const inserted = await insertCandidates(session.id, merged);

      const filterUsed = filterText.trim();
      let rankSucceeded = true;
      let unscored = 0;
      try {
        const outcome = await rankCandidates(filterText, inserted);
        unscored = outcome.unscoredIds.length;
      } catch (rankErr) {
        console.warn('Ranking failed, falling back to insertion order', rankErr);
        rankSucceeded = false;
      }

      const refreshed = rankSucceeded
        ? await fetchSessionCandidates(session.id)
        : inserted;
      setCandidates(refreshed);
      setRankFailed(!rankSucceeded);
      // Partial-failure: some chunks never scored. Surface the count so
      // the review banner can offer a targeted retry instead of leaving
      // genuine matches stranded unscored at the bottom of the drawer.
      setUnscoredCount(rankSucceeded ? unscored : 0);
      setStep('review');
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });

      // The no-matches modal only makes sense when the user actually gave
      // the AI a filter to match against AND ranking actually returned
      // useful scores. Without a filter, ranking is just a soft sort +
      // bullet generator. Without a successful rank, the scores are 0
      // and a "no matches" modal would be misleading — that's what the
      // inline banner is for.
      if (!filterUsed || !rankSucceeded) return;
      const top = Math.max(0, ...refreshed.map((c) => c.ai_relevance_score ?? 0));
      if (top < NO_MATCH_THRESHOLD) {
        setRankModal({ kind: 'no-matches' });
      }
    } catch (e) {
      toast.error(friendlyError(e, 'Could not start the import. Try again.'));
    } finally {
      setRanking(false);
    }
  };

  // ---- review actions ----

  const matchMap = useMemo(() => {
    const draftsForMatch = candidates.map((c) => ({
      source: c.source as ImportSource,
      name: c.name,
      email: c.email || undefined,
      phone: c.phone || undefined,
    }));
    const byIndex = findMatchesAgainstPeople(draftsForMatch, existingPeople);
    const byId = new Map<string, string>();
    candidates.forEach((c, i) => {
      const pid = byIndex.get(i);
      if (pid) byId.set(c.id, pid);
    });
    return byId;
  }, [candidates, existingPeople]);

  // When the no-matches modal is up but the user hasn't clicked "Browse all
  // anyway" yet, hide candidates that fall below the threshold so the page
  // behind doesn't tease them.
  const aliveCandidates = useMemo(() => {
    let alive = candidates.filter((c) => !c.promoted && !c.dismissed);
    if (rankModal?.kind === 'no-matches' && !showLowScores) {
      alive = alive.filter((c) => (c.ai_relevance_score ?? 0) >= NO_MATCH_THRESHOLD);
    }
    return alive;
  }, [candidates, rankModal, showLowScores]);

  // Quality gating: when the user provided a real filter, only
  // genuinely-qualifying candidates land in the curated top-N. Without
  // a filter, "everyone the AI saw" is the natural slice — no quality
  // floor since the AI has no goal to measure against.
  const filterActive = !!filterText.trim();
  const visibleCandidates = useMemo(() => {
    // No filter → nothing to score against, so just surface the first N in
    // insertion order (topN is a real cap here).
    if (!filterActive) return aliveCandidates.slice(0, topN);
    // With a filter, topN is a soft TARGET, not a cap. Show every candidate
    // that clears the quality bar — if 25 finance contacts qualify, show all
    // 25, not just the selected 20. The selector still scopes intent (the
    // user picks a ballpark) but we never bury a genuine match in the drawer
    // just to honor an arbitrary ceiling. Fewer than N qualifying still shows
    // fewer; the "go under" side of this was already the behavior.
    return aliveCandidates.filter(
      (c) => (c.ai_relevance_score ?? 0) >= TOP_QUALITY_THRESHOLD,
    );
  }, [aliveCandidates, topN, filterActive]);
  const drawerCandidates = useMemo(() => {
    const visibleIds = new Set(visibleCandidates.map((c) => c.id));
    return aliveCandidates.filter((c) => !visibleIds.has(c.id));
  }, [aliveCandidates, visibleCandidates]);

  const handlePromote = async (
    c: ImportCandidateRow,
    payload?: { fields?: Partial<Person>; circleIds?: string[]; eventIds?: string[] },
  ) => {
    setReviewBusyId(c.id);
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
      // Close the review sheet if it was open for this candidate.
      setReviewingId((cur) => (cur === c.id ? null : cur));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not add that person.'));
    } finally {
      setReviewBusyId(null);
    }
  };

  const handleMerge = async (c: ImportCandidateRow, personId: string) => {
    setReviewBusyId(c.id);
    try {
      await mergeCandidateIntoPerson(c, personId);
      setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, promoted: true } : x)));
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['persons', personId] });
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setReviewingId((cur) => (cur === c.id ? null : cur));
      toast.success('Merged into existing person.');
    } catch (e) {
      toast.error(friendlyError(e, 'Could not merge.'));
    } finally {
      setReviewBusyId(null);
    }
  };

  const handleDismiss = async (c: ImportCandidateRow) => {
    setReviewBusyId(c.id);
    try {
      await dismissCandidate(c.id);
      setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, dismissed: true } : x)));
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
      setReviewingId((cur) => (cur === c.id ? null : cur));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not dismiss.'));
    } finally {
      setReviewBusyId(null);
    }
  };

  // Core bulk-add. Promotes (or merges, when matched) a specific set of
  // candidates, optionally dropping them all into the given circles/events.
  // Used by both "Add all" (whole visible list) and select-mode subset adds.
  // Uses each candidate's AI bullets — per-field edits happen in the review
  // sheet, not here.
  const runBulkAdd = async (
    targets: ImportCandidateRow[],
    opts: { circleIds: string[]; eventIds: string[] },
  ): Promise<number> => {
    if (targets.length === 0) return 0;
    haptics.medium();
    setBulkAdding(true);
    let promoted = 0;
    let merged = 0;
    let failed = 0;
    const done: string[] = [];
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
        done.push(c.id);
        setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, promoted: true } : x)));
      } catch (e) {
        console.error('Bulk add failed for', c.id, e);
        failed++;
      }
    }
    setBulkAdding(false);
    qc.invalidateQueries({ queryKey: ['persons'] });
    qc.invalidateQueries({ queryKey: ['person_circles'] });
    qc.invalidateQueries({ queryKey: ['person_events'] });
    qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
    const parts: string[] = [];
    if (promoted) parts.push(`${promoted} added`);
    if (merged) parts.push(`${merged} merged`);
    if (failed) parts.push(`${failed} failed`);
    toast.success(parts.join(' · ') || 'Done');
    return done.length;
  };

  // "Add all N" path — confirms via the bulk sheet, acts on the whole
  // visible list, then closes the sheet.
  const handleAddEveryone = async (opts: { circleIds: string[]; eventIds: string[] }) => {
    await runBulkAdd(visibleCandidates, opts);
    setBulkOptionsOpen(false);
    setBulkFromSelection(false);
  };

  // Select-mode subset path — acts on just the checked rows, then clears
  // the selection but STAYS in select mode so the user can immediately pick
  // the next batch for a different circle/event. Already-promoted rows drop
  // out of the list on the next render, so the selection naturally resets.
  const handleAddSelected = async (opts: { circleIds: string[]; eventIds: string[] }) => {
    const targets = visibleCandidates.filter((c) => selectedIds.has(c.id));
    await runBulkAdd(targets, opts);
    setBulkOptionsOpen(false);
    setBulkFromSelection(false);
    setSelectedIds(new Set());
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

  // How many drafts each source contributed this session — used to label
  // the source card "0 new" when it ran successfully but yielded nothing,
  // instead of misleading the user with a green "✓ Done".
  const perSourceDraftCounts = useMemo(() => {
    const m = new Map<ImportSource, number>();
    for (const d of drafts) {
      m.set(d.source, (m.get(d.source) || 0) + 1);
    }
    return m;
  }, [drafts]);

  const reviewingCandidate = useMemo(
    () => candidates.find((c) => c.id === reviewingId) || null,
    [candidates, reviewingId],
  );

  const handleRestart = () => {
    haptics.medium();
    setRankModal(null);
    setRankFailed(false);
    setUnscoredCount(0);
    setShowLowScores(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkFromSelection(false);
    setCandidates([]);
    setDrafts([]);
    setCompletedSources(new Set());
    setSelectedSources(new Set());
    setGatherProgress(0);
    setStep('pick');
  };

  // Retry the rank pass against the candidates that are already in the
  // DB. Cheaper than re-gathering — same candidate ids, just a fresh AI
  // call. Surfaces as a small banner on the review screen when the
  // initial pass failed.
  const handleRetryRank = async () => {
    if (candidates.length === 0) return;
    setRanking(true);
    try {
      const sessionId = candidates[0]?.session_id;
      if (!sessionId) return;
      // On a total failure (rankFailed) nothing was scored, so retry the
      // whole alive set. On a partial failure, only re-rank the rows that
      // never got a score — re-ranking already-scored rows just burns AI
      // budget and risks re-shuffling matches the user is already happy with.
      const alive = candidates.filter((c) => !c.promoted && !c.dismissed);
      const toRank = rankFailed
        ? alive
        : alive.filter((c) => c.ai_relevance_score == null);
      const target = toRank.length > 0 ? toRank : alive;
      const outcome = await rankCandidates(filterText, target);
      const refreshed = await fetchSessionCandidates(sessionId);
      setCandidates(refreshed);
      setRankFailed(false);
      setUnscoredCount(outcome.unscoredIds.length);
      const filterUsed = filterText.trim();
      if (filterUsed) {
        const top = Math.max(0, ...refreshed.map((c) => c.ai_relevance_score ?? 0));
        if (top < NO_MATCH_THRESHOLD) {
          setRankModal({ kind: 'no-matches' });
        }
      }
    } catch (e) {
      console.warn('Retry rank failed', e);
    } finally {
      setRanking(false);
    }
  };

  const aliveCount = aliveCandidates.length;
  const promotedCount = candidates.filter((c) => c.promoted).length;

  return (
    <div
      className="flex flex-col min-h-screen safe-top"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
        touchAction: 'pan-y',
      }}
      {...swipe.bind}
    >
      {/* Nav bar — sits below the notch overlay (Index.tsx) with the same
          fade-to-page gradient PersonEditPage uses, so the header bleeds
          into content instead of presenting a hard edge. */}
      <div
        className="sticky z-20 flex items-center justify-between px-3 pt-3 pb-2 border-b border-[hsl(0_0%_100%/0.06)] backdrop-blur-xl"
        style={{
          top: 'env(safe-area-inset-top)',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.3) 100%)',
        }}
      >
        <button
          onClick={goBack}
          className="glass-pill !h-10 !w-10 !p-0 flex items-center justify-center"
          aria-label={step === 'pick' || step === 'review' ? 'Close' : 'Back'}
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <h1 className="font-display text-[20px] text-foreground">Smart Import</h1>
        <span className="w-10" />
      </div>

      <div className="flex-1 pb-8 safe-bottom">
        {step === 'pick' && (
          <PickStep
            selectedSources={selectedSources}
            onToggle={toggleSource}
            onContinue={goToFilter}
          />
        )}
        {step === 'filter' && (
          <FilterStep
            filterText={filterText}
            setFilterText={setFilterText}
            topN={topN}
            setTopN={setTopN}
            sources={Array.from(selectedSources)}
            onContinue={goToGather}
          />
        )}
        {step === 'gather' && (
          <GatherStep
            selectedSources={selectedSources}
            completedSources={completedSources}
            perSourceDraftCounts={perSourceDraftCounts}
            gathering={gathering}
            gatherProgress={gatherProgress}
            draftsCount={drafts.length}
            filterText={filterText}
            onRunContacts={runContacts}
            onPickLinkedIn={() => linkedInRef.current?.click()}
            onPickFile={() => fileRef.current?.click()}
            onShowLinkedInHowTo={() => setLinkedInHowTo(true)}
            onShowFileHowTo={() => setSpreadsheetHowTo(true)}
            onContinue={handleRankAndReview}
            ranking={ranking}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            visibleCandidates={visibleCandidates}
            drawerCount={drawerCandidates.length}
            matchMap={matchMap}
            reviewBusyId={reviewBusyId}
            bulkAdding={bulkAdding}
            rankFailed={rankFailed}
            unscoredCount={unscoredCount}
            ranking={ranking}
            onRetryRank={handleRetryRank}
            onReview={(c) => setReviewingId(c.id)}
            onPromote={handlePromote}
            onMerge={handleMerge}
            onDismiss={handleDismiss}
            onOpenDrawer={() => setDrawerOpen(true)}
            onAddEveryone={() => { setBulkFromSelection(false); setBulkOptionsOpen(true); }}
            onRestart={handleRestart}
            promotedCount={promotedCount}
            aliveCount={aliveCount}
            onDone={onClose}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onEnterSelectMode={enterSelectMode}
            onExitSelectMode={exitSelectMode}
            onToggleSelect={toggleSelect}
            onSelectAll={() => setSelectedIds(new Set(visibleCandidates.map((c) => c.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onAddSelected={() => { setBulkFromSelection(true); setBulkOptionsOpen(true); }}
          />
        )}
      </div>

      {drawerOpen && (
        <ImportDrawerSheet
          candidates={drawerCandidates}
          matchMap={matchMap}
          reviewBusyId={reviewBusyId}
          onReview={(c) => setReviewingId(c.id)}
          onPromote={handlePromote}
          onMerge={handleMerge}
          onDismiss={handleDismiss}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      <ImportCandidateReviewSheet
        candidate={reviewingCandidate}
        matchedPersonId={reviewingCandidate ? matchMap.get(reviewingCandidate.id) : undefined}
        busy={!!reviewingCandidate && reviewBusyId === reviewingCandidate.id}
        onClose={() => setReviewingId(null)}
        onPromote={(payload) => reviewingCandidate && handlePromote(reviewingCandidate, payload)}
        onMerge={(pid) => reviewingCandidate && handleMerge(reviewingCandidate, pid)}
        onDismiss={() => reviewingCandidate && handleDismiss(reviewingCandidate)}
      />

      <BulkAddOptionsSheet
        open={bulkOptionsOpen}
        candidateCount={bulkFromSelection ? selectedIds.size : visibleCandidates.length}
        subset={bulkFromSelection}
        busy={bulkAdding}
        onClose={() => {
          if (bulkAdding) return;
          setBulkOptionsOpen(false);
          setBulkFromSelection(false);
        }}
        onConfirm={bulkFromSelection ? handleAddSelected : handleAddEveryone}
      />

      <LinkedInHowToModal open={linkedInHowTo} onClose={() => setLinkedInHowTo(false)} />

      <InfoModal
        open={!!contactsResultModal}
        title={
          (contactsResultModal?.totalRead ?? 0) === 0
            ? 'No contacts found'
            : 'Already imported'
        }
        onClose={() => setContactsResultModal(null)}
      >
        {(contactsResultModal?.totalRead ?? 0) === 0 ? (
          <p>
            iOS didn't return any contacts. If your Contacts app has people in
            it, check <span className="text-foreground">Settings → Membr → Contacts</span> — if
            you granted "Limited" access, no contacts were selected.
          </p>
        ) : (
          <>
            <p>
              All {contactsResultModal?.totalRead} of your iOS contacts were already
              pulled in a previous import. Nothing new to add this time.
            </p>
            <p className="text-[12px] text-[hsl(var(--foreground)/0.55)]">
              Existing imports are still waiting on the People page → "Pending imports".
            </p>
          </>
        )}
      </InfoModal>
      <SpreadsheetHowToModal open={spreadsheetHowTo} onClose={() => setSpreadsheetHowTo(false)} />

      <RankResultModal
        open={!!rankModal}
        kind={rankModal?.kind ?? null}
        filterText={filterText}
        onShowAll={() => { setShowLowScores(true); setRankModal(null); }}
        onRestart={() => { setRankModal(null); handleRestart(); }}
        onClose={() => setRankModal(null)}
      />

      <input
        ref={linkedInRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) runLinkedInFile(f);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) runFile(f);
        }}
      />
    </div>
  );
}

// ============================================================================
// Step components
// ============================================================================

function PickStep({
  selectedSources,
  onToggle,
  onContinue,
}: {
  selectedSources: Set<ImportSource>;
  onToggle: (s: ImportSource) => void;
  onContinue: () => void;
}) {
  const sources: Array<{
    key: ImportSource;
    title: string;
    icon: typeof Users;
    description: string;
    disabled?: boolean;
    comingSoon?: boolean;
  }> = [
    {
      key: 'contacts',
      title: 'iOS Contacts',
      icon: Users,
      description: 'Names, phones, emails, company, and photos (when available).',
      disabled: !isNativeIOS(),
    },
    {
      key: 'linkedin',
      title: 'LinkedIn export',
      icon: FileText,
      description: 'Drop a Connections.csv. Names, titles, companies, connection dates.',
    },
    {
      key: 'spreadsheet',
      title: 'A file',
      icon: Files,
      description: 'CSV, Excel, or a photo. Spreadsheets become rows of people; photos turn into names from any visible text.',
    },
    {
      key: 'calendar',
      title: 'Calendar',
      icon: Calendar,
      description: 'Attendees from your recent meetings.',
      disabled: !isCalendarSourceAvailable(),
      comingSoon: !isCalendarSourceAvailable(),
    },
  ];

  return (
    <div className="px-5 pt-2">
      <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-4 leading-relaxed">
        Pick the sources to pull from. Next we'll ask who you're looking for and
        how many top matches to surface — AI puts those at the front, every other
        contact is still one tap away in the drawer.
      </p>
      <div className="space-y-3">
        {sources.map((s) => {
          const Icon = s.icon;
          const selected = selectedSources.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => !s.disabled && onToggle(s.key)}
              disabled={s.disabled}
              className={cn(
                'w-full text-left transition-colors',
                selected ? 'glass-warm p-4 ring-2 ring-primary/50' : 'glass p-4',
                s.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-[hsl(0_0%_100%/0.06)] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[17px] text-foreground tracking-[-0.01em]">
                      {s.title}
                    </span>
                    {s.comingSoon && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(0_0%_100%/0.08)] text-[hsl(var(--foreground)/0.6)]">
                        Soon
                      </span>
                    )}
                    {s.disabled && !s.comingSoon && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(0_0%_100%/0.08)] text-[hsl(var(--foreground)/0.6)]">
                        iOS only
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[hsl(var(--foreground)/0.6)] mt-0.5 leading-snug">
                    {s.description}
                  </div>
                </div>
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center',
                    selected
                      ? 'bg-primary border-primary'
                      : 'border-[hsl(0_0%_100%/0.25)]',
                  )}
                >
                  {selected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <button
          onClick={onContinue}
          disabled={selectedSources.size === 0}
          className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function FilterStep({
  filterText,
  setFilterText,
  topN,
  setTopN,
  sources,
  onContinue,
}: {
  filterText: string;
  setFilterText: (s: string) => void;
  topN: TopN;
  setTopN: (n: TopN) => void;
  sources: ImportSource[];
  onContinue: () => void;
}) {
  const richSources = sources.some((s) => s === 'linkedin' || s === 'spreadsheet');
  const onlyContacts = sources.length === 1 && sources[0] === 'contacts';

  return (
    <div className="px-5 pt-2">
      <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-3 leading-relaxed">
        Who are you trying to import? Be specific — AI uses this to pick your best
        matches from everything we pull next. The rest stay accessible in the drawer.
      </p>
      <textarea
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        rows={5}
        placeholder={EXAMPLE_FILTER}
        className="glass-input w-full p-3 text-[14px] leading-relaxed resize-none"
        autoFocus
      />

      <div className="mt-3 flex items-start gap-2 text-[11px] text-[hsl(var(--foreground)/0.55)] leading-snug">
        <Info className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={1.75} />
        <span>
          Filter accuracy depends on what each source provides.{' '}
          {onlyContacts
            ? 'Contacts may only have names and phone numbers — the AI has less to work with than with a file or LinkedIn.'
            : richSources
              ? 'File contents and LinkedIn titles give the AI a lot to work with; Contacts may only have phone numbers. We do our best with what each source has.'
              : 'Some sources expose more fields than others.'}
        </span>
      </div>

      <div className="mt-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--foreground)/0.55)] mb-1">
          How many top matches to surface
        </div>
        <p className="text-[11px] text-[hsl(var(--foreground)/0.5)] leading-snug mb-2">
          AI will review every imported contact and put its top picks at the front of the list. The rest still show in the "More imports" drawer.
        </p>
        <div className="flex items-center gap-1.5">
          {TOP_N_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => { haptics.selection(); setTopN(n); }}
              className={cn(
                'glass-pill flex-1 h-10 text-[13px] font-medium active:scale-[0.97] transition-transform',
                n === topN
                  ? '!bg-[rgba(224,48,48,0.22)] !border-[rgba(224,48,48,0.40)] text-foreground'
                  : 'text-[hsl(var(--foreground)/0.7)]',
              )}
            >
              Top {n}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full h-[52px] mt-6 rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
      >
        {filterText.trim() ? 'Continue' : 'Skip filter'}
      </button>
    </div>
  );
}

const EXAMPLE_FILTER =
  "e.g. People who could help with my finance career — investors, founders, senior PMs. Skip college friends and family.";

function GatherStep({
  selectedSources,
  completedSources,
  perSourceDraftCounts,
  gathering,
  gatherProgress,
  draftsCount,
  filterText,
  onRunContacts,
  onPickLinkedIn,
  onPickFile,
  onShowLinkedInHowTo,
  onShowFileHowTo,
  onContinue,
  ranking,
}: {
  selectedSources: Set<ImportSource>;
  completedSources: Set<ImportSource>;
  perSourceDraftCounts: Map<ImportSource, number>;
  gathering: ImportSource | null;
  gatherProgress: number;
  draftsCount: number;
  filterText: string;
  onRunContacts: () => void;
  onPickLinkedIn: () => void;
  onPickFile: () => void;
  onShowLinkedInHowTo: () => void;
  onShowFileHowTo: () => void;
  onContinue: () => void;
  ranking: boolean;
}) {
  // For each completed source, was it productive or did it yield zero new?
  // Used to swap the green "Done" pill for a muted "0 new" so the user
  // doesn't read "✓ Done" and assume everything pulled when in fact the
  // source returned nothing.
  const ranEmpty = (s: ImportSource) =>
    completedSources.has(s) && (perSourceDraftCounts.get(s) ?? 0) === 0;
  const canContinue = draftsCount > 0 && !ranking && gathering === null;
  return (
    <div className="px-5 pt-2">
      <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-4 leading-relaxed">
        Run the sources you picked. You can continue with what you have whenever you're ready — no need to finish all of them.
        {filterText && (
          <>
            {' '}Filter:{' '}
            <span className="font-display-italic text-foreground">"{filterText.length > 60 ? filterText.slice(0, 60).trimEnd() + '…' : filterText}"</span>
          </>
        )}
      </p>

      <div className="space-y-3">
        {selectedSources.has('contacts') && (
          <SourceCard
            title="iOS Contacts"
            description="Grant permission, then we'll read everyone."
            busy={gathering === 'contacts'}
            done={completedSources.has('contacts') && !ranEmpty('contacts')}
            ranEmpty={ranEmpty('contacts')}
            progress={gathering === 'contacts' ? gatherProgress : undefined}
            ctaLabel={
              completedSources.has('contacts')
                ? (ranEmpty('contacts') ? 'Run again' : 'Done')
                : 'Read contacts'
            }
            onClick={onRunContacts}
          />
        )}
        {selectedSources.has('linkedin') && (
          <SourceCard
            title="LinkedIn export"
            description={
              <>
                Connections.csv from your LinkedIn data export.{' '}
                <button
                  type="button"
                  onClick={onShowLinkedInHowTo}
                  className="underline text-foreground"
                >
                  How to export
                </button>
              </>
            }
            busy={gathering === 'linkedin'}
            done={completedSources.has('linkedin') && !ranEmpty('linkedin')}
            ranEmpty={ranEmpty('linkedin')}
            ctaLabel={completedSources.has('linkedin') ? 'Pick another' : 'Choose CSV'}
            onClick={onPickLinkedIn}
            icon={FileText}
          />
        )}
        {selectedSources.has('spreadsheet') && (
          <SourceCard
            title="A file"
            description={
              <>
                CSV, Excel, or a photo. Auto-routed by file type.{' '}
                <button
                  type="button"
                  onClick={onShowFileHowTo}
                  className="underline text-foreground"
                >
                  How it works
                </button>
              </>
            }
            busy={gathering === 'spreadsheet'}
            done={completedSources.has('spreadsheet') && !ranEmpty('spreadsheet')}
            ranEmpty={ranEmpty('spreadsheet')}
            ctaLabel={completedSources.has('spreadsheet') ? 'Add another file' : 'Choose file'}
            onClick={onPickFile}
            icon={Files}
          />
        )}
        {selectedSources.has('calendar') && (
          <div className="glass p-4 opacity-60">
            <div className="font-display text-[15px] text-foreground">Calendar</div>
            <div className="text-[12px] text-[hsl(var(--foreground)/0.55)] mt-1">
              Coming soon. Skip this source for now.
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 text-center text-[12px] text-[hsl(var(--foreground)/0.55)]">
        {draftsCount > 0 ? `${draftsCount} pulled so far` : 'Nothing pulled yet'}
      </div>

      <div className="mt-5">
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {ranking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Finding your best matches…
            </>
          ) : draftsCount === 0 ? (
            'Pull from at least one source'
          ) : (
            <>
              <Sparkles className="w-4 h-4" strokeWidth={1.75} />
              {`Find best matches from ${draftsCount}`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SourceCard({
  title,
  description,
  busy,
  done,
  ranEmpty,
  progress,
  ctaLabel,
  onClick,
  icon: Icon,
}: {
  title: string;
  description: React.ReactNode;
  busy: boolean;
  done: boolean;
  /** Source has been run successfully but yielded zero new candidates.
   *  Renders a muted neutral state instead of the green "✓ Done" so the
   *  user doesn't read "Done" and assume content was pulled. */
  ranEmpty?: boolean;
  progress?: number;
  ctaLabel: string;
  onClick: () => void;
  icon?: typeof Users;
}) {
  return (
    <div className={cn('glass p-4', done && 'glass-warm')}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="w-10 h-10 rounded-md bg-[hsl(0_0%_100%/0.06)] flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-foreground" strokeWidth={1.75} />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] text-foreground">{title}</span>
            {ranEmpty && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(0_0%_100%/0.08)] text-[hsl(var(--foreground)/0.6)]">
                0 new
              </span>
            )}
          </div>
          <div className="text-[12px] text-[hsl(var(--foreground)/0.6)] mt-0.5 leading-snug">
            {description}
          </div>
          {progress !== undefined && progress > 0 && (
            <div className="text-[11px] text-[hsl(var(--foreground)/0.55)] mt-1">
              Read {progress}…
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={busy}
        className={cn(
          'w-full mt-3 h-10 rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50',
          done ? 'bg-[hsl(0_0%_100%/0.06)] text-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {done && !busy && <Check className="w-4 h-4" strokeWidth={2} />}
        {busy ? 'Reading…' : ctaLabel}
      </button>
    </div>
  );
}

function ReviewStep({
  visibleCandidates,
  drawerCount,
  matchMap,
  reviewBusyId,
  bulkAdding,
  rankFailed,
  unscoredCount,
  ranking,
  onRetryRank,
  onReview,
  onPromote,
  onMerge,
  onDismiss,
  onOpenDrawer,
  onAddEveryone,
  onRestart,
  promotedCount,
  aliveCount,
  onDone,
  selectMode,
  selectedIds,
  onEnterSelectMode,
  onExitSelectMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onAddSelected,
}: {
  visibleCandidates: ImportCandidateRow[];
  drawerCount: number;
  matchMap: Map<string, string>;
  reviewBusyId: string | null;
  bulkAdding: boolean;
  rankFailed: boolean;
  unscoredCount: number;
  ranking: boolean;
  onRetryRank: () => Promise<void> | void;
  onReview: (c: ImportCandidateRow) => void;
  onPromote: (c: ImportCandidateRow) => Promise<void> | void;
  onMerge: (c: ImportCandidateRow, personId: string) => Promise<void> | void;
  onDismiss: (c: ImportCandidateRow) => Promise<void> | void;
  onOpenDrawer: () => void;
  onAddEveryone: () => Promise<void> | void;
  onRestart: () => void;
  promotedCount: number;
  aliveCount: number;
  onDone: () => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onEnterSelectMode: () => void;
  onExitSelectMode: () => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onAddSelected: () => void;
}) {
  const allSelected = visibleCandidates.length > 0 && selectedIds.size === visibleCandidates.length;
  return (
    <div className="px-5 pt-2">
      <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-3 leading-relaxed">
        {rankFailed
          ? `${aliveCount} pulled`
          : visibleCandidates.length === 0
            ? `0 strong matches out of ${aliveCount} — see the drawer for the rest`
            : `${visibleCandidates.length} strong ${visibleCandidates.length === 1 ? 'match' : 'matches'} of ${aliveCount}`}.
        {promotedCount > 0 && (
          <span className="text-foreground"> {promotedCount} added so far.</span>
        )}
      </p>

      {rankFailed && (
        <button
          onClick={onRetryRank}
          disabled={ranking}
          className="w-full glass-warm p-3 mb-3 flex items-center gap-2.5 text-[12px] text-foreground active:scale-[0.99] transition-transform disabled:opacity-60"
        >
          <RotateCcw className={cn('w-3.5 h-3.5 text-primary shrink-0', ranking && 'animate-spin')} strokeWidth={1.75} />
          <span className="text-left flex-1 leading-snug">
            <span className="font-semibold text-foreground">AI couldn't surface best matches.</span>{' '}
            Showing everyone in import order — tap to retry.
          </span>
        </button>
      )}

      {/* Partial-failure banner: ranking mostly worked, but some chunks
          never scored (timeout / parse fail). Those candidates sit unscored
          at the bottom of the drawer and could include genuine matches, so
          offer a targeted retry that only re-ranks the unscored ones. */}
      {!rankFailed && unscoredCount > 0 && (
        <button
          onClick={onRetryRank}
          disabled={ranking}
          className="w-full glass-warm p-3 mb-3 flex items-center gap-2.5 text-[12px] text-foreground active:scale-[0.99] transition-transform disabled:opacity-60"
        >
          <RotateCcw className={cn('w-3.5 h-3.5 text-primary shrink-0', ranking && 'animate-spin')} strokeWidth={1.75} />
          <span className="text-left flex-1 leading-snug">
            <span className="font-semibold text-foreground">
              {unscoredCount} {unscoredCount === 1 ? 'contact' : 'contacts'} couldn't be scored.
            </span>{' '}
            They're unranked at the bottom of the drawer — tap to retry just those.
          </span>
        </button>
      )}

      {visibleCandidates.length > 0 && !selectMode && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={onAddEveryone}
              disabled={bulkAdding}
              className="flex-1 glass-pill h-11 inline-flex items-center justify-center gap-1.5 text-[13px] text-foreground active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {bulkAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-primary" strokeWidth={2} />}
              {bulkAdding ? 'Adding…' : `Add all ${visibleCandidates.length}`}
            </button>
            <button
              onClick={onRestart}
              disabled={bulkAdding}
              className="glass-pill h-11 px-3.5 inline-flex items-center justify-center gap-1.5 text-[13px] text-[hsl(var(--foreground)/0.75)] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              Restart
            </button>
          </div>
          {/* Entry point for incremental adds: pick a subset → one circle/
              event, then another subset → another. Sits under "Add all" so
              the whole-list path stays the default one-tap action. */}
          <button
            onClick={onEnterSelectMode}
            className="w-full mb-3 h-9 inline-flex items-center justify-center gap-1.5 text-[12px] text-[hsl(var(--foreground)/0.7)] active:scale-[0.99] transition-transform"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={1.75} />
            Select people to add by group
          </button>
        </>
      )}

      {/* Select-mode toolbar — replaces the Add-all bar while picking a
          subset. Select-all / clear on the left, Done on the right. The
          actual "Add N selected" CTA is the sticky bar near the bottom. */}
      {visibleCandidates.length > 0 && selectMode && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={allSelected ? onClearSelection : onSelectAll}
            disabled={bulkAdding}
            className="glass-pill h-11 px-3.5 inline-flex items-center justify-center gap-1.5 text-[12px] text-foreground active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
          <div className="flex-1 text-center text-[12px] text-[hsl(var(--foreground)/0.6)]">
            {selectedIds.size} selected
          </div>
          <button
            onClick={onExitSelectMode}
            disabled={bulkAdding}
            className="glass-pill h-11 px-3.5 inline-flex items-center justify-center text-[12px] text-[hsl(var(--foreground)/0.75)] active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Done
          </button>
        </div>
      )}

      {visibleCandidates.length === 0 ? (
        <div className="glass p-8 text-center mt-4">
          <p className="text-sm font-display-italic text-[hsl(var(--foreground)/0.6)]">
            {aliveCount === 0
              ? 'All caught up. Hit Done to head back.'
              : 'Nothing left to review at the top — open the drawer for more.'}
          </p>
          {aliveCount === 0 && (
            <button
              onClick={onRestart}
              className="mt-4 glass-pill h-10 px-4 inline-flex items-center justify-center gap-1.5 text-[13px] text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              Restart import
            </button>
          )}
        </div>
      ) : (
        <div className={cn('space-y-2.5 mt-2', selectMode && selectedIds.size > 0 && 'pb-20')}>
          {visibleCandidates.map((c) => {
            const matchedId = matchMap.get(c.id);
            return (
              <div key={c.id} className={cn(reviewBusyId === c.id && 'opacity-60')}>
                <ImportCandidateRowComponent
                  candidate={c}
                  matchedPersonId={matchedId}
                  busy={reviewBusyId === c.id}
                  onReview={() => onReview(c)}
                  onPromote={() => (matchedId ? onMerge(c, matchedId) : onPromote(c))}
                  onDismiss={() => onDismiss(c)}
                  selectMode={selectMode}
                  selected={selectedIds.has(c.id)}
                  onToggleSelect={() => onToggleSelect(c.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky CTA while in select mode with at least one row checked.
          Opens the same circle/event sheet, scoped to the selection. */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed left-0 right-0 bottom-0 z-30 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
          <button
            onClick={onAddSelected}
            disabled={bulkAdding}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {bulkAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.25} />}
            {bulkAdding ? 'Adding…' : `Add ${selectedIds.size} to a group`}
          </button>
        </div>
      )}

      {drawerCount > 0 && !selectMode && (
        <button
          onClick={onOpenDrawer}
          className="w-full mt-4 glass-pill h-12 inline-flex items-center justify-center gap-2 text-[14px] text-foreground"
        >
          <Users className="w-4 h-4" strokeWidth={1.75} />
          More imports — {drawerCount} waiting
        </button>
      )}

      {!selectMode && (
        <button
          onClick={onDone}
          className="w-full mt-6 h-[52px] rounded-2xl bg-[hsl(0_0%_100%/0.06)] text-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform"
        >
          Done
        </button>
      )}
    </div>
  );
}

function ImportDrawerSheet({
  candidates,
  matchMap,
  reviewBusyId,
  onReview,
  onPromote,
  onMerge,
  onDismiss,
  onClose,
}: {
  candidates: ImportCandidateRow[];
  matchMap: Map<string, string>;
  reviewBusyId: string | null;
  onReview: (c: ImportCandidateRow) => void;
  onPromote: (c: ImportCandidateRow) => Promise<void> | void;
  onMerge: (c: ImportCandidateRow, personId: string) => Promise<void> | void;
  onDismiss: (c: ImportCandidateRow) => Promise<void> | void;
  onClose: () => void;
}) {
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
            More imports
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
          <p className="text-[12px] text-[hsl(var(--foreground)/0.6)]">
            {candidates.length} more pulled. Lower AI relevance to your filter — review and add any you want.
          </p>
          {candidates.map((c) => {
            const matchedId = matchMap.get(c.id);
            return (
              <div key={c.id} className={cn(reviewBusyId === c.id && 'opacity-60')}>
                <ImportCandidateRowComponent
                  candidate={c}
                  matchedPersonId={matchedId}
                  busy={reviewBusyId === c.id}
                  onReview={() => onReview(c)}
                  onPromote={() => (matchedId ? onMerge(c, matchedId) : onPromote(c))}
                  onDismiss={() => onDismiss(c)}
                />
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
