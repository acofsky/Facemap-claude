import { ReactNode, useState } from 'react';
import { Home, Users, LayoutGrid, Search, User } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { QuickAddSheet } from './QuickAddSheet';
import { LogEncounterModal } from './LogEncounterModal';
import { CornerFabs } from './CornerFabs';

export type Tab = 'home' | 'people' | 'circles' | 'recall' | 'profile';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

// M2 — 5-tab IA per spec. Recall earns its own tab; FABs live in the corner.
const tabs = [
  { id: 'home' as Tab,    icon: Home,        label: 'Home' },
  { id: 'people' as Tab,  icon: Users,       label: 'People' },
  { id: 'circles' as Tab, icon: LayoutGrid,  label: 'Circles' },
  { id: 'recall' as Tab,  icon: Search,      label: 'Recall' },
  { id: 'profile' as Tab, icon: User,        label: 'Profile' },
];

export function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [logEncounterOpen, setLogEncounterOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background relative">
      {/* Notch cover — solid background overlay that always sits above the
          safe-area-inset-top region. Anything that scrolls passes underneath
          this, so content never peeks above the camera notch. */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-background safe-top pointer-events-none"
      />
      <main className="flex-1 overflow-y-auto pb-24 safe-top">
        {children}
      </main>

      {/* Corner-anchored FABs (Visual Brief §4.2). Hidden when Recall tab is
          active so the search field has breathing room. */}
      {activeTab !== 'recall' && (
        <CornerFabs
          onAddPerson={() => setAddPersonOpen(true)}
          onLogEncounter={() => setLogEncounterOpen(true)}
        />
      )}

      {/* Bottom Nav — Surface 1, hairline top border, no blur. Hidden via CSS
          when the keyboard is open (see html.kb-open .bottom-tabs in index.css). */}
      <nav
        className="bottom-tabs fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom"
        style={{ backgroundColor: 'hsl(var(--surface-1))', borderTop: '1px solid hsl(0 0% 100% / 0.08)' }}
      >
        <div className="flex items-stretch justify-around h-16 px-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors min-w-[44px]"
                style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-text))' }}
              >
                <tab.icon className="w-5 h-5" strokeWidth={1.75} />
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {addPersonOpen && (
          <QuickAddSheet onClose={() => setAddPersonOpen(false)} />
        )}
      </AnimatePresence>

      <LogEncounterModal open={logEncounterOpen} onClose={() => setLogEncounterOpen(false)} />
    </div>
  );
}
