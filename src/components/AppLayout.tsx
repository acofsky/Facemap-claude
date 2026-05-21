import { ReactNode, useState } from 'react';
import { Home, Network, Search, User, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { QuickAddSheet } from './QuickAddSheet';
import { LogEncounterModal } from './LogEncounterModal';
import { EventSheet } from './EventSheet';
import { VoiceAddSheet } from './VoiceAddSheet';
import { QuickActionsMenu } from './QuickActionsMenu';
import { QuickActionsProvider } from '@/lib/quick-actions';
import { haptics } from '@/lib/haptics';

export type Tab = 'home' | 'network' | 'recall' | 'profile';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

// 4-tab IA with a central FAB. The frosted nav floats above the content
// (Liquid Glass §3.5); the FAB protrudes upward through the nav and opens
// a radial bubble menu of quick actions.
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
  const [voiceAddOpen, setVoiceAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openAction = (fn: () => void) => () => {
    haptics.medium();
    setMenuOpen(false);
    fn();
  };

  return (
    <QuickActionsProvider
      value={{
        openAddPerson: () => setAddPersonOpen(true),
        openLogEncounter: () => setLogEncounterOpen(true),
        openNewEvent: () => setNewEventOpen(true),
        openVoiceAdd: () => setVoiceAddOpen(true),
      }}
    >
    <div className="ambient-backdrop flex flex-col min-h-screen max-w-md mx-auto relative overflow-hidden">
      {/* Notch cover — the ambient-backdrop already paints behind, but we
          want a fade-to-black mask near the camera notch so glass at the top
          of a page doesn't blend awkwardly with system status text. */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 safe-top pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
        }}
      />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-32 safe-top scrollbar-hide relative z-10">
        {children}
      </main>

      {/* Quick-actions bubble menu — opens above the FAB when menuOpen=true.
          Bubbles animate from the FAB's screen position upward. */}
      <QuickActionsMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAddPerson={openAction(() => setAddPersonOpen(true))}
        onLogEncounter={openAction(() => setLogEncounterOpen(true))}
        onNewEvent={openAction(() => setNewEventOpen(true))}
        onVoiceAdd={openAction(() => setVoiceAddOpen(true))}
      />

      {/* Frosted bottom nav — floats above content with rounded glass +
          inset highlight + drop shadow. The FAB sits in the centre cell
          and protrudes upward via negative top margin (Liquid Glass §3.5). */}
      <nav
        className="bottom-tabs fixed left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom px-3 pb-3 pt-0"
        aria-label="Primary"
      >
        <div className="frosted-nav h-[68px] grid grid-cols-5 items-center px-1">
          {tabs.slice(0, 2).map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
          <div className="flex items-center justify-center">
            <button
              onClick={() => {
                haptics.light();
                setMenuOpen((v) => !v);
              }}
              aria-label={menuOpen ? 'Close quick actions' : 'Open quick actions'}
              aria-expanded={menuOpen}
              className="frosted-fab w-[52px] h-[52px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ marginTop: '-22px' }}
            >
              <Plus
                className="w-6 h-6 transition-transform duration-200"
                strokeWidth={2}
                style={{ transform: menuOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
              />
            </button>
          </div>
          {tabs.slice(2).map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
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
        {voiceAddOpen && (
          <VoiceAddSheet onClose={() => setVoiceAddOpen(false)} />
        )}
      </AnimatePresence>

      <LogEncounterModal open={logEncounterOpen} onClose={() => setLogEncounterOpen(false)} />

      {/* Dim overlay behind the bubble menu so the backdrop reads as one
          composed material moment instead of bubbles floating in space. */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[35] bg-black/55"
          />
        )}
      </AnimatePresence>
    </div>
    </QuickActionsProvider>
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
      className="flex flex-col items-center justify-center gap-0.5 h-full transition-colors min-w-[44px]"
      style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.7)' }}
    >
      <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.75} />
      <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
    </button>
  );
}
