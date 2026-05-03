import { ReactNode, useState } from 'react';
import { Home, Users, CircleDot, Plus, Search, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickAddSheet } from './QuickAddSheet';
import { RecallSearch } from './RecallSearch';

type Tab = 'home' | 'people' | 'circles' | 'profile';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onSelectPerson?: (id: string) => void;
  children: ReactNode;
}

const tabs = [
  { id: 'home' as Tab, icon: Home, label: 'Home' },
  { id: 'people' as Tab, icon: Users, label: 'People' },
  { id: 'circles' as Tab, icon: CircleDot, label: 'Circles' },
  { id: 'profile' as Tab, icon: User, label: 'Profile' },
];

export function AppLayout({ activeTab, onTabChange, onSelectPerson, children }: AppLayoutProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background relative">
      {/* Search FAB */}
      <button
        onClick={() => setSearchOpen(true)}
        className="fixed top-4 right-4 z-30 w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
      >
        <Search className="w-4 h-4 text-muted-foreground" />
      </button>

      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/80 backdrop-blur-xl border-t border-border z-40">
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* FAB */}
        <button
          onClick={() => setQuickAddOpen(true)}
          className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center warm-shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-7 h-7" />
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
