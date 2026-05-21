import { createContext, useContext, type ReactNode } from 'react';

interface QuickActions {
  openAddPerson: () => void;
  openLogEncounter: () => void;
  openNewEvent: () => void;
  openVoiceAdd: () => void;
}

const QuickActionsContext = createContext<QuickActions | null>(null);

/**
 * Lets any page (HomePage's Quick Actions hero, e.g.) open the global
 * sheets that AppLayout owns. AppLayout supplies the openers; consumers
 * pull them via `useQuickActions()` and call them on button taps.
 */
export function QuickActionsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: QuickActions;
}) {
  return <QuickActionsContext.Provider value={value}>{children}</QuickActionsContext.Provider>;
}

export function useQuickActions(): QuickActions {
  const ctx = useContext(QuickActionsContext);
  if (!ctx) {
    // Defensive — return no-ops on the off chance a consumer renders
    // outside AppLayout (e.g. in a test). Don't throw, since detail
    // pages would otherwise be untestable without setting up the layout.
    return {
      openAddPerson: () => {},
      openLogEncounter: () => {},
      openNewEvent: () => {},
      openVoiceAdd: () => {},
    };
  }
  return ctx;
}
