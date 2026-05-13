import { ReactNode, useState } from 'react';
import { Home, Users, LayoutGrid, Plus, Search, User } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { QuickAddSheet } from './QuickAddSheet';
import { RecallSearch } from './RecallSearch';

type Tab = 'home' | 'people' | 'circles' | 'profile';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onSelectPerson?: (id: string) => void;
  children: ReactNode;
}

// 4 tabs in M1; Recall becomes its own tab in M2 IA restructure.
const tabs = [
  { id: 'home' as Tab,    icon: Home,        label: 'Home' },
  { id: 'people' as Tab,  icon: Users,       label: 'People' },
  { id: 'circles' as Tab, icon: LayoutGrid,  label: 'Circles' },
  { id: 'profile' as Tab, icon: User,        label: 'Profile' },
];

export function AppLayout({ activeTab, onTabChange, onSelectPerson, children }: AppLayoutProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background relative">
      {/* Search trigger — corner button. Replaced by Recall tab in M2. */}
      <button
        onClick={() => setSearchOpen(true)}
        aria-label="Open Recall search"
        className="fixed top-4 right-4 z-30 w-10 h-10 rounded-full bg-surface-2 border border-hairline-stronger flex items-center justify-center active:scale-95 transition-transform safe-top"
      >
        <Search className="w-4 h-4 text-muted-text" />
      </button>

      <main className="flex-1 overflow-y-auto pb-24 safe-top">
        {children}
      </main>

      {/* Bottom Nav — Surface 1 bg, hairline top border, no blur. */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 safe-bottom"
        style={{ backgroundColor: 'hsl(var(--surface-1))', borderTop: '1px solid hsl(0 0% 100% / 0.08)' }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors min-w-[44px] min-h-[44px]"
                style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-text))' }}
              >
                <tab.icon className="w-5 h-5" strokeWidth={1.75} />
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Primary FAB (centered today; corner-anchored in M2 per spec §4.2). */}
        <button
          onClick={() => setQuickAddOpen(true)}
          aria-label="Add new person"
          className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: '0 4px 16px hsl(var(--primary) / 0.35)' }}
        >
          <Plus className="w-7 h-7" strokeWidth={2} />
        </button>
      </nav>

      <AnimatePresence>
        {quickAddOpen && (
          <QuickAddSheet onClose={() => setQuickAddOpen(false)} />
        )}
        {searchOpen && onSelectPerson && (
          <RecallSearch
            onClose={() => setSearchOpen(false)}
            onSelectPerson={(id) => { setSearchOpen(false); onSelectPerson(id); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
