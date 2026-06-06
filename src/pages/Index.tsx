import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppLayout, type Tab } from '@/components/AppLayout';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { HomePage } from './HomePage';
import { NetworkPage } from './NetworkPage';
import { RecallPage } from './RecallPage';
import { ProfilePage } from './ProfilePage';
import { PersonProfilePage } from './PersonProfilePage';
import { CircleDetailPage } from './CircleDetailPage';
import { EventDetailPage } from './EventDetailPage';
import { QuizPage } from './QuizPage';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { ImportPage } from './ImportPage';
import { WhatsNewPopup, WHATS_NEW_VERSION, WHATS_NEW_SEEN_KEY } from '@/components/WhatsNewPopup';
import { onNotificationTap } from '@/lib/notifications';

const Index = () => {
  const reduceMotion = useReduceMotion();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  // When set, a full-screen group quiz overlays the (still-selected) circle
  // or event, so backing out of the quiz returns to that detail page.
  const [quizGroup, setQuizGroup] = useState<{ kind: 'circle' | 'event'; id: string } | null>(null);
  const [eodSheetOpen, setEodSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  // "What's New" on the first load after updating — but only for EXISTING
  // users. A brand-new user gets onboarding instead; we pre-mark this version
  // seen for them so it never pops after they finish. Mount-only on purpose
  // (reads the onboarded flag as it was at load, so finishing onboarding in
  // this same session never triggers it).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onboarded = window.localStorage.getItem('membr_onboarded') === 'true';
    const seen = window.localStorage.getItem(WHATS_NEW_SEEN_KEY);
    if (!onboarded) {
      window.localStorage.setItem(WHATS_NEW_SEEN_KEY, WHATS_NEW_VERSION);
    } else if (seen !== WHATS_NEW_VERSION) {
      setWhatsNewOpen(true);
    }
  }, []);

  const dismissWhatsNew = () => {
    window.localStorage.setItem(WHATS_NEW_SEEN_KEY, WHATS_NEW_VERSION);
    setWhatsNewOpen(false);
  };

  // Onboarding can pre-arm a Smart Import by stashing this flag. We pop the
  // flag on mount so we never re-open the wizard after the user has dismissed
  // it once.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('membr.pendingImport') === '1') {
      window.localStorage.removeItem('membr.pendingImport');
      setImportOpen(true);
    }
  }, []);

  // EoD notification tap → open the Add Person sheet with the spec §9 variant
  // header ("Who'd you meet today?"). Listener is no-op on web.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    onNotificationTap((kind) => {
      if (kind === 'end-of-day') {
        setSelectedPersonId(null);
        setSelectedCircleId(null);
        setSelectedEventId(null);
        setQuizGroup(null);
        setActiveTab('home');
        setEodSheetOpen(true);
      }
    }).then((u) => { unsubscribe = u; });
    return () => unsubscribe?.();
  }, []);


  // Detail pages are exclusive — fullscreen overlays that suspend the tab UI.
  if (quizGroup) {
    return (
      <div className="ambient-backdrop max-w-md mx-auto min-h-[100dvh] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none"
          style={{
            height: 'calc(env(safe-area-inset-top) + 24px)',
            background:
              'linear-gradient(180deg, #000 0%, #000 calc(env(safe-area-inset-top) - 4px), rgba(0,0,0,0.55) calc(env(safe-area-inset-top) + 6px), rgba(0,0,0,0) 100%)',
          }}
        />
        <QuizPage
          group={quizGroup}
          onBack={() => setQuizGroup(null)}
          onSelectPerson={(id) => {
            setQuizGroup(null);
            setSelectedCircleId(null);
            setSelectedEventId(null);
            setSelectedPersonId(id);
          }}
        />
      </div>
    );
  }
  if (selectedPersonId) {
    return (
      <div className="ambient-backdrop max-w-md mx-auto min-h-[100dvh] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none"
          style={{
            height: 'calc(env(safe-area-inset-top) + 24px)',
            background:
              'linear-gradient(180deg, #000 0%, #000 calc(env(safe-area-inset-top) - 4px), rgba(0,0,0,0.55) calc(env(safe-area-inset-top) + 6px), rgba(0,0,0,0) 100%)',
          }}
        />
        <PersonProfilePage
          personId={selectedPersonId}
          onBack={() => setSelectedPersonId(null)}
          onSelectPerson={(id) => setSelectedPersonId(id)}
        />
      </div>
    );
  }
  if (selectedCircleId) {
    return (
      <div className="ambient-backdrop max-w-md mx-auto min-h-[100dvh] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none"
          style={{
            height: 'calc(env(safe-area-inset-top) + 24px)',
            background:
              'linear-gradient(180deg, #000 0%, #000 calc(env(safe-area-inset-top) - 4px), rgba(0,0,0,0.55) calc(env(safe-area-inset-top) + 6px), rgba(0,0,0,0) 100%)',
          }}
        />
        <CircleDetailPage
          circleId={selectedCircleId}
          onBack={() => setSelectedCircleId(null)}
          onSelectPerson={(id) => {
            setSelectedCircleId(null);
            setSelectedPersonId(id);
          }}
          onStartQuiz={() => setQuizGroup({ kind: 'circle', id: selectedCircleId })}
        />
      </div>
    );
  }
  if (selectedEventId) {
    return (
      <div className="ambient-backdrop max-w-md mx-auto min-h-[100dvh] relative overflow-hidden">
        <div
          aria-hidden="true"
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none"
          style={{
            height: 'calc(env(safe-area-inset-top) + 24px)',
            background:
              'linear-gradient(180deg, #000 0%, #000 calc(env(safe-area-inset-top) - 4px), rgba(0,0,0,0.55) calc(env(safe-area-inset-top) + 6px), rgba(0,0,0,0) 100%)',
          }}
        />
        <EventDetailPage
          eventId={selectedEventId}
          onBack={() => setSelectedEventId(null)}
          onSelectPerson={(id) => {
            setSelectedEventId(null);
            setSelectedPersonId(id);
          }}
          onStartQuiz={() => setQuizGroup({ kind: 'event', id: selectedEventId })}
        />
      </div>
    );
  }

  return (
    <>
      <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'home' && (
          <HomePage
            onSelectPerson={setSelectedPersonId}
            onSelectCircle={setSelectedCircleId}
          />
        )}
        {activeTab === 'network' && (
          <NetworkPage
            onSelectPerson={setSelectedPersonId}
            onSelectCircle={setSelectedCircleId}
            onSelectEvent={setSelectedEventId}
            onOpenImport={() => setImportOpen(true)}
          />
        )}
        {activeTab === 'recall' && <RecallPage onSelectPerson={setSelectedPersonId} />}
        {activeTab === 'profile' && <ProfilePage onOpenImport={() => setImportOpen(true)} />}
      </AppLayout>
      <AnimatePresence>
        {eodSheetOpen && (
          <QuickAddSheet variant="end-of-day" onClose={() => setEodSheetOpen(false)} />
        )}
      </AnimatePresence>

      {/* Smart Import slides in from the right (iOS push nav), same motion
          as the Profile → Notifications subpage, and slides back out on
          close. Rendered as an overlay (not an early return) so the tab
          underneath stays mounted and AnimatePresence can play the exit. */}
      <AnimatePresence>
        {importOpen && (
          <motion.div
            key="smart-import"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: reduceMotion ? 0 : 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[60] ambient-backdrop max-w-md mx-auto overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none"
              style={{
                height: 'calc(env(safe-area-inset-top) + 24px)',
                background:
                  'linear-gradient(180deg, #000 0%, #000 calc(env(safe-area-inset-top) - 4px), rgba(0,0,0,0.55) calc(env(safe-area-inset-top) + 6px), rgba(0,0,0,0) 100%)',
              }}
            />
            <ImportPage
              onClose={() => setImportOpen(false)}
              onSelectPerson={(id) => {
                setImportOpen(false);
                setSelectedPersonId(id);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <WhatsNewPopup
        open={whatsNewOpen}
        onTryImport={() => {
          dismissWhatsNew();
          setImportOpen(true);
        }}
        onClose={dismissWhatsNew}
      />
    </>
  );
};

export default Index;
