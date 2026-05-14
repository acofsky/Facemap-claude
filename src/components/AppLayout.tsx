import { ReactNode, useState } from 'react';
import { Home, Network, Search, User } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { QuickAddSheet } from './QuickAddSheet';
import { LogEncounterModal } from './LogEncounterModal';
import { EventSheet } from './EventSheet';
import { MainButton } from './MainButton';

export type Tab = 'home' | 'network' | 'recall' | 'profile';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

// 4-tab IA — People + Circles collapsed into Network so the central Add
// button has a slot of its own. Recall and Profile keep their tabs; the
// MainButton sits in the middle cell as a raised, primary-red affordance.
const tabs = [
  { id: 'home' as Tab,    icon: Home,    label: 'Home' },
  { id: 'network' as Tab, icon: Network, label: 'Network' },
  { id: 'recall' as Tab,  icon: Search,  label: 'Recall' },
  { id: 'profile' as Tab, icon: User,    label: 'Profile' },
];

export function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [logEncounterOpen, setLogEncounterOpen] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background relative">
      {/* Notch cover — solid background overlay that always sits above the
          safe-area-inset-top region. Anything that scrolls passes underneath
          this, so content never peeks above the camera notch. */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-background safe-top pointer-events-none"
      />
      <main className="flex-1 overflow-y-auto pb-44 safe-top">
        {children}
      </main>

      {/* Central Add button. Suppressed on Recall so the search field has
          breathing room. The bubble menu fans out above the button. */}
      {activeTab !== 'recall' && (
        <MainButton
          onAddPerson={() => setAddPersonOpen(true)}
          onLogEncounter={() => setLogEncounterOpen(true)}
          onNewEvent={() => setNewEventOpen(true)}
        />
      )}

      {/* Bottom Nav — 4 tabs split 2/2 around a transparent middle slot.
          The MainButton above sits visually in the middle slot. Surface 1
          background, hairline top border, no blur. */}
      <nav
        className="bottom-tabs fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom"
        style={{ backgroundColor: 'hsl(var(--surface-1))', borderTop: '1px solid hsl(0 0% 100% / 0.08)' }}
      >
        <div className="flex items-stretch h-16 px-1">
          {/* Left two tabs */}
          {tabs.slice(0, 2).map((tab) => (
            <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => onTabChange(tab.id)} />
          ))}
          {/* Spacer for the MainButton */}
          <div aria-hidden="true" className="flex-1" />
          {/* Right two tabs */}
          {tabs.slice(2).map((tab) => (
            <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => onTabChange(tab.id)} />
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {addPersonOpen && (
          <QuickAddSheet onClose={() => setAddPersonOpen(false)} />
        )}
        {newEventOpen && (
          <EventSheet onClose={() => setNewEventOpen(false)} />
        )}
      </AnimatePresence>

      <LogEncounterModal open={logEncounterOpen} onClose={() => setLogEncounterOpen(false)} />
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { id: Tab; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors min-w-[44px]"
      style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-text))' }}
    >
      <Icon className="w-5 h-5" strokeWidth={1.75} />
      <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
    </button>
  );
}
