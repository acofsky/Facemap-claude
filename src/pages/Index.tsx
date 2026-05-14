import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AppLayout, type Tab } from '@/components/AppLayout';
import { HomePage } from './HomePage';
import { NetworkPage } from './NetworkPage';
import { RecallPage } from './RecallPage';
import { ProfilePage } from './ProfilePage';
import { PersonProfilePage } from './PersonProfilePage';
import { CircleDetailPage } from './CircleDetailPage';
import { EventDetailPage } from './EventDetailPage';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { onNotificationTap } from '@/lib/notifications';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eodSheetOpen, setEodSheetOpen] = useState(false);

  // EoD notification tap → open the Add Person sheet with the spec §9 variant
  // header ("Who'd you meet today?"). Listener is no-op on web.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    onNotificationTap((kind) => {
      if (kind === 'end-of-day') {
        setSelectedPersonId(null);
        setSelectedCircleId(null);
        setSelectedEventId(null);
        setActiveTab('home');
        setEodSheetOpen(true);
      }
    }).then((u) => { unsubscribe = u; });
    return () => unsubscribe?.();
  }, []);

  // Detail pages are exclusive — fullscreen overlays that suspend the tab UI.
  if (selectedPersonId) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background relative">
        <div
          aria-hidden="true"
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-background safe-top pointer-events-none"
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
      <div className="max-w-md mx-auto min-h-screen bg-background relative">
        <div
          aria-hidden="true"
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-background safe-top pointer-events-none"
        />
        <CircleDetailPage
          circleId={selectedCircleId}
          onBack={() => setSelectedCircleId(null)}
          onSelectPerson={(id) => {
            setSelectedCircleId(null);
            setSelectedPersonId(id);
          }}
        />
      </div>
    );
  }
  if (selectedEventId) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-background relative">
        <div
          aria-hidden="true"
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-background safe-top pointer-events-none"
        />
        <EventDetailPage
          eventId={selectedEventId}
          onBack={() => setSelectedEventId(null)}
          onSelectPerson={(id) => {
            setSelectedEventId(null);
            setSelectedPersonId(id);
          }}
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
          />
        )}
        {activeTab === 'recall' && <RecallPage onSelectPerson={setSelectedPersonId} />}
        {activeTab === 'profile' && <ProfilePage />}
      </AppLayout>
      <AnimatePresence>
        {eodSheetOpen && (
          <QuickAddSheet variant="end-of-day" onClose={() => setEodSheetOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default Index;
