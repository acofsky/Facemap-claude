import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Calendar, Camera, Check, FileSpreadsheet, FileText, Image as ImageIcon,
  Info, Loader2, Sparkles, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useSwipeBack } from '@/hooks/use-swipe-back';
import { usePersons } from '@/hooks/use-data';
import { haptics } from '@/lib/haptics';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { isNativeIOS } from '@/lib/ios-contacts';
import { ImportCandidateCard } from '@/components/import/ImportCandidateCard';
import { LinkedInHowToModal } from '@/components/import/LinkedInHowToModal';
import { SpreadsheetHowToModal } from '@/components/import/SpreadsheetHowToModal';
import { sourceLabel } from '@/components/import/sourceLabels';
import { gatherContactsCandidates } from '@/lib/import/sources/contacts-source';
import { parseLinkedInCsv } from '@/lib/import/sources/linkedin-source';
import { parseSpreadsheetFile, SpreadsheetParseError } from '@/lib/import/sources/spreadsheet-source';
import { gatherPhotoOcrCandidates } from '@/lib/import/sources/photo-ocr-source';
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
import type { CandidateDraft, ImportCandidateRow, ImportSource } from '@/lib/import/types';

const TOP_N = 20;

type Step = 'pick' | 'gather' | 'filter' | 'review';

interface ImportPageProps {
  onClose: () => void;
  onSelectPerson?: (id: string) => void;
}

export function ImportPage({ onClose, onSelectPerson }: ImportPageProps) {
  const qc = useQueryClient();
  const swipe = useSwipeBack(onClose);
  const { data: existingPeople = [] } = usePersons();

  const [step, setStep] = useState<Step>('pick');
  const [selectedSources, setSelectedSources] = useState<Set<ImportSource>>(new Set());
  const [drafts, setDrafts] = useState<CandidateDraft[]>([]);
  const [gathering, setGathering] = useState<ImportSource | null>(null);
  const [gatherProgress, setGatherProgress] = useState(0);
  const [completedSources, setCompletedSources] = useState<Set<ImportSource>>(new Set());
  const [linkedInHowTo, setLinkedInHowTo] = useState(false);
  const [spreadsheetHowTo, setSpreadsheetHowTo] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [ranking, setRanking] = useState(false);
  const [candidates, setCandidates] = useState<ImportCandidateRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const linkedInRef = useRef<HTMLInputElement>(null);
  const spreadsheetRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const toggleSource = (source: ImportSource) => {
    haptics.selection();
    setSelectedSources((cur) => {
      const next = new Set(cur);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const handleGoToGather = () => {
    haptics.medium();
    setStep('gather');
  };

  // ---- gather handlers ----

  const runContacts = async () => {
    setGathering('contacts');
    setGatherProgress(0);
    try {
      const got = await gatherContactsCandidates({
        onProgress: setGatherProgress,
      });
      setDrafts((d) => [...d, ...got]);
      setCompletedSources((s) => new Set(s).add('contacts'));
      toast.success(`Pulled ${got.length} contacts`);
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

  const runSpreadsheetFile = async (file: File) => {
    setGathering('spreadsheet');
    try {
      const { drafts: got, unmappedRows } = await parseSpreadsheetFile(file);
      if (got.length === 0) {
        toast.error('No rows with a name found in that spreadsheet.');
      } else {
        setDrafts((d) => [...d, ...got]);
        const skipped = unmappedRows > 0 ? ` (skipped ${unmappedRows} row${unmappedRows === 1 ? '' : 's'} with no name)` : '';
        toast.success(`Parsed ${got.length} people from ${file.name}${skipped}`);
      }
      setCompletedSources((s) => new Set(s).add('spreadsheet'));
    } catch (e) {
      if (e instanceof SpreadsheetParseError) {
        toast.error(e.message);
      } else {
        toast.error(friendlyError(e, "Couldn't parse that file as CSV."));
      }
    } finally {
      setGathering(null);
    }
  };

  const runPhotoFile = async (file: File) => {
    setGathering('photo_ocr');
    try {
      const got = await gatherPhotoOcrCandidates(file);
      if (got.length === 0) {
        toast.error("No names visible in this photo. Try one with name badges or a caption.");
      } else {
        setDrafts((d) => [...d, ...got]);
        toast.success(`Found ${got.length} ${got.length === 1 ? 'person' : 'people'} in the photo`);
      }
      // Photo OCR can be re-run with more photos — mark complete after first attempt
      setCompletedSources((s) => new Set(s).add('photo_ocr'));
    } catch (e) {
      toast.error(friendlyError(e, 'Could not read that photo.'));
    } finally {
      setGathering(null);
    }
  };

  const allSelectedDone = useMemo(
    () =>
      Array.from(selectedSources).every(
        (s) => completedSources.has(s) || s === 'calendar',
      ),
    [selectedSources, completedSources],
  );

  const handleGoToFilter = () => {
    if (drafts.length === 0) {
      toast.error('Nothing to import yet — pull from at least one source.');
      return;
    }
    haptics.medium();
    setStep('filter');
  };

  // ---- filter + rank step ----

  const handleRankAndReview = async () => {
    setRanking(true);
    try {
      // 1) collapse cross-source dupes
      const merged = mergeDrafts(drafts);
      // 2) match against existing People (informational, doesn't block insert)
      // (the matches map is regenerated in the review step against the live rows)
      const sourcesUsed = Array.from(selectedSources);
      const session = await createImportSession({
        filterText,
        sources: sourcesUsed,
      });
      const inserted = await insertCandidates(session.id, merged);
      // 3) ask the AI to rank
      try {
        await rankCandidates(filterText, inserted);
        // Re-fetch to pick up the new scores. We refetch instead of
        // splicing because the edge function writes the bullets/score
        // directly to the DB rows.
        const refreshed = await fetchSessionCandidates(session.id);
        setCandidates(refreshed);
      } catch (rankErr) {
        console.warn('Ranking failed, falling back to insertion order', rankErr);
        toast.error('Ranking failed — showing all candidates instead.');
        setCandidates(inserted);
      }
      setStep('review');
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
    } catch (e) {
      toast.error(friendlyError(e, 'Could not start the import. Try again.'));
    } finally {
      setRanking(false);
    }
  };

  // ---- review step actions ----

  const visibleCandidates = useMemo(() => {
    const alive = candidates.filter((c) => !c.promoted && !c.dismissed);
    return alive.slice(0, TOP_N);
  }, [candidates]);
  const drawerCandidates = useMemo(() => {
    const alive = candidates.filter((c) => !c.promoted && !c.dismissed);
    return alive.slice(TOP_N);
  }, [candidates]);

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

  const handlePromote = async (c: ImportCandidateRow, bullets: string[]) => {
    setReviewBusyId(c.id);
    try {
      const withEditedBullets: ImportCandidateRow = { ...c, ai_bullets: bullets as unknown as ImportCandidateRow['ai_bullets'] };
      await promoteCandidate(withEditedBullets);
      // optimistic remove
      setCandidates((cur) => cur.map((x) => (x.id === c.id ? { ...x, promoted: true } : x)));
      qc.invalidateQueries({ queryKey: ['persons'] });
      qc.invalidateQueries({ queryKey: ['import_candidates_pending'] });
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
    } catch (e) {
      toast.error(friendlyError(e, 'Could not dismiss.'));
    } finally {
      setReviewBusyId(null);
    }
  };

  const aliveCount = candidates.filter((c) => !c.promoted && !c.dismissed).length;
  const promotedCount = candidates.filter((c) => c.promoted).length;

  return (
    <div
      className="ambient-backdrop fixed inset-0 z-[55] overflow-y-auto safe-top safe-bottom flex flex-col"
      style={{
        transform: swipe.offsetX > 0 ? `translateX(${swipe.offsetX}px)` : undefined,
        transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
        touchAction: 'pan-y',
      }}
      {...swipe.bind}
    >
      <div className="sticky top-0 z-20 flex items-center justify-between px-3 pt-3 pb-2 backdrop-blur-xl bg-black/40">
        <button
          onClick={onClose}
          className="glass-pill !h-10 !w-10 !p-0 flex items-center justify-center"
          aria-label="Close"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <h1 className="font-display text-[20px] text-foreground">Smart Import</h1>
        <span className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {step === 'pick' && (
          <PickStep
            selectedSources={selectedSources}
            onToggle={toggleSource}
            onContinue={handleGoToGather}
          />
        )}
        {step === 'gather' && (
          <GatherStep
            selectedSources={selectedSources}
            completedSources={completedSources}
            gathering={gathering}
            gatherProgress={gatherProgress}
            draftsCount={drafts.length}
            onRunContacts={runContacts}
            onPickLinkedIn={() => linkedInRef.current?.click()}
            onPickSpreadsheet={() => spreadsheetRef.current?.click()}
            onPickPhoto={() => photoRef.current?.click()}
            onShowLinkedInHowTo={() => setLinkedInHowTo(true)}
            onShowSpreadsheetHowTo={() => setSpreadsheetHowTo(true)}
            onContinue={handleGoToFilter}
            allDone={allSelectedDone}
          />
        )}
        {step === 'filter' && (
          <FilterStep
            filterText={filterText}
            setFilterText={setFilterText}
            draftsCount={drafts.length}
            ranking={ranking}
            onRank={handleRankAndReview}
            sources={Array.from(selectedSources)}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            visibleCandidates={visibleCandidates}
            drawerCount={drawerCandidates.length}
            matchMap={matchMap}
            reviewBusyId={reviewBusyId}
            onPromote={handlePromote}
            onMerge={handleMerge}
            onDismiss={handleDismiss}
            onOpenDrawer={() => setDrawerOpen(true)}
            onSelectPerson={onSelectPerson}
            promotedCount={promotedCount}
            aliveCount={aliveCount}
            onDone={onClose}
          />
        )}
      </div>

      {drawerOpen && (
        <ImportDrawerSheet
          candidates={drawerCandidates}
          matchMap={matchMap}
          reviewBusyId={reviewBusyId}
          onPromote={handlePromote}
          onMerge={handleMerge}
          onDismiss={handleDismiss}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      <LinkedInHowToModal open={linkedInHowTo} onClose={() => setLinkedInHowTo(false)} />
      <SpreadsheetHowToModal open={spreadsheetHowTo} onClose={() => setSpreadsheetHowTo(false)} />

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
        ref={spreadsheetRef}
        type="file"
        accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) runSpreadsheetFile(f);
        }}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) runPhotoFile(f);
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
      title: 'A spreadsheet',
      icon: FileSpreadsheet,
      description: 'Your own CSV of people. Notes and convo columns flow into the bullets.',
    },
    {
      key: 'photo_ocr',
      title: 'A photo',
      icon: ImageIcon,
      description: 'Group shot, slide, conference badge. AI reads visible names.',
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
        Pull people from one or more sources. We'll ask you to describe who you're
        looking for, then rank the results with AI.
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

function GatherStep({
  selectedSources,
  completedSources,
  gathering,
  gatherProgress,
  draftsCount,
  onRunContacts,
  onPickLinkedIn,
  onPickSpreadsheet,
  onPickPhoto,
  onShowLinkedInHowTo,
  onShowSpreadsheetHowTo,
  onContinue,
  allDone,
}: {
  selectedSources: Set<ImportSource>;
  completedSources: Set<ImportSource>;
  gathering: ImportSource | null;
  gatherProgress: number;
  draftsCount: number;
  onRunContacts: () => void;
  onPickLinkedIn: () => void;
  onPickSpreadsheet: () => void;
  onPickPhoto: () => void;
  onShowLinkedInHowTo: () => void;
  onShowSpreadsheetHowTo: () => void;
  onContinue: () => void;
  allDone: boolean;
}) {
  return (
    <div className="px-5 pt-2">
      <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-4 leading-relaxed">
        Run each source. Photo OCR can be re-run with multiple photos.
      </p>

      <div className="space-y-3">
        {selectedSources.has('contacts') && (
          <SourceCard
            title="iOS Contacts"
            description="Grant permission, then we'll read everyone."
            busy={gathering === 'contacts'}
            done={completedSources.has('contacts')}
            progress={gathering === 'contacts' ? gatherProgress : undefined}
            ctaLabel={completedSources.has('contacts') ? 'Done' : 'Read contacts'}
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
            done={completedSources.has('linkedin')}
            ctaLabel={completedSources.has('linkedin') ? 'Pick another' : 'Choose CSV'}
            onClick={onPickLinkedIn}
            icon={FileText}
          />
        )}
        {selectedSources.has('spreadsheet') && (
          <SourceCard
            title="A spreadsheet"
            description={
              <>
                CSV/TSV with a header row. Name + any columns of notes or convos.{' '}
                <button
                  type="button"
                  onClick={onShowSpreadsheetHowTo}
                  className="underline text-foreground"
                >
                  How it works
                </button>
              </>
            }
            busy={gathering === 'spreadsheet'}
            done={completedSources.has('spreadsheet')}
            ctaLabel={completedSources.has('spreadsheet') ? 'Add another file' : 'Choose file'}
            onClick={onPickSpreadsheet}
            icon={FileSpreadsheet}
          />
        )}
        {selectedSources.has('photo_ocr') && (
          <SourceCard
            title="A photo"
            description="A photo with visible name tags, captions, or a slide of speakers."
            busy={gathering === 'photo_ocr'}
            done={completedSources.has('photo_ocr')}
            ctaLabel={completedSources.has('photo_ocr') ? 'Add another photo' : 'Pick photo'}
            onClick={onPickPhoto}
            icon={Camera}
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
          disabled={draftsCount === 0 || !allDone}
          className="w-full h-[52px] rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          {draftsCount === 0 ? 'Pull from at least one source' : `Continue with ${draftsCount}`}
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
  progress,
  ctaLabel,
  onClick,
  icon: Icon,
}: {
  title: string;
  description: React.ReactNode;
  busy: boolean;
  done: boolean;
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
          <div className="font-display text-[15px] text-foreground">{title}</div>
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

function FilterStep({
  filterText,
  setFilterText,
  draftsCount,
  ranking,
  onRank,
  sources,
}: {
  filterText: string;
  setFilterText: (s: string) => void;
  draftsCount: number;
  ranking: boolean;
  onRank: () => void;
  sources: ImportSource[];
}) {
  const richSources = sources.some((s) => s === 'linkedin' || s === 'photo_ocr' || s === 'spreadsheet');
  const onlyContacts = sources.length === 1 && sources[0] === 'contacts';

  return (
    <div className="px-5 pt-2">
      <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-3 leading-relaxed">
        Who are you trying to import? Be specific — the AI uses this to rank the {draftsCount} stubs from your sources.
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
            ? 'Contacts may only have names and phone numbers — the AI has less to work with than with a spreadsheet or LinkedIn.'
            : richSources
              ? 'Spreadsheet notes columns and LinkedIn titles give the AI a lot to work with; Contacts may only have phone numbers. We do our best with what each source has.'
              : 'Some sources expose more fields than others.'}
        </span>
      </div>

      <button
        onClick={onRank}
        disabled={ranking}
        className="w-full h-[52px] mt-6 rounded-2xl bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {ranking ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Ranking with AI…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" strokeWidth={1.75} />
            {filterText.trim() ? 'Rank & review' : 'Skip filter, just review'}
          </>
        )}
      </button>
    </div>
  );
}

const EXAMPLE_FILTER =
  "e.g. People who could help with my finance career — investors, founders, senior PMs. Skip college friends and family.";

function ReviewStep({
  visibleCandidates,
  drawerCount,
  matchMap,
  reviewBusyId,
  onPromote,
  onMerge,
  onDismiss,
  onOpenDrawer,
  onSelectPerson: _onSelectPerson,
  promotedCount,
  aliveCount,
  onDone,
}: {
  visibleCandidates: ImportCandidateRow[];
  drawerCount: number;
  matchMap: Map<string, string>;
  reviewBusyId: string | null;
  onPromote: (c: ImportCandidateRow, bullets: string[]) => Promise<void> | void;
  onMerge: (c: ImportCandidateRow, personId: string) => Promise<void> | void;
  onDismiss: (c: ImportCandidateRow) => Promise<void> | void;
  onOpenDrawer: () => void;
  onSelectPerson?: (id: string) => void;
  promotedCount: number;
  aliveCount: number;
  onDone: () => void;
}) {
  return (
    <div className="px-5 pt-2">
      <p className="text-[13px] text-[hsl(var(--foreground)/0.6)] mb-2 leading-relaxed">
        AI-ranked top {Math.min(TOP_N, visibleCandidates.length)}. Edit bullets inline, then Add to People.
        {promotedCount > 0 && (
          <span className="text-foreground"> {promotedCount} added so far.</span>
        )}
      </p>

      {visibleCandidates.length === 0 ? (
        <div className="glass p-8 text-center mt-4">
          <p className="text-sm font-display-italic text-[hsl(var(--foreground)/0.6)]">
            {aliveCount === 0
              ? 'All caught up. Hit Done to head back.'
              : 'Nothing in the top 20 right now.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mt-3">
          {visibleCandidates.map((c) => (
            <div key={c.id} className={cn(reviewBusyId === c.id && 'opacity-60')}>
              <ImportCandidateCard
                candidate={c}
                matchedPersonId={matchMap.get(c.id)}
                onPromote={(bullets) => onPromote(c, bullets)}
                onMerge={(pid) => onMerge(c, pid)}
                onDismiss={() => onDismiss(c)}
              />
            </div>
          ))}
        </div>
      )}

      {drawerCount > 0 && (
        <button
          onClick={onOpenDrawer}
          className="w-full mt-4 glass-pill h-12 inline-flex items-center justify-center gap-2 text-[14px] text-foreground"
        >
          <Users className="w-4 h-4" strokeWidth={1.75} />
          More imports — {drawerCount} waiting
        </button>
      )}

      <button
        onClick={onDone}
        className="w-full mt-6 h-[52px] rounded-2xl bg-[hsl(0_0%_100%/0.06)] text-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform"
      >
        Done
      </button>
    </div>
  );
}

function ImportDrawerSheet({
  candidates,
  matchMap,
  reviewBusyId,
  onPromote,
  onMerge,
  onDismiss,
  onClose,
}: {
  candidates: ImportCandidateRow[];
  matchMap: Map<string, string>;
  reviewBusyId: string | null;
  onPromote: (c: ImportCandidateRow, bullets: string[]) => Promise<void> | void;
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
        <div className="flex-1 overflow-y-auto p-5 space-y-3 safe-bottom">
          <p className="text-[12px] text-[hsl(var(--foreground)/0.6)]">
            {candidates.length} more pulled. Lower AI relevance to your filter — review and add any you want.
          </p>
          {candidates.map((c) => (
            <div key={c.id} className={cn(reviewBusyId === c.id && 'opacity-60')}>
              <ImportCandidateCard
                candidate={c}
                matchedPersonId={matchMap.get(c.id)}
                onPromote={(bullets) => onPromote(c, bullets)}
                onMerge={(pid) => onMerge(c, pid)}
                onDismiss={() => onDismiss(c)}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
