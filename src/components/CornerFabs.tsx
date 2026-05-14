import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Zap, CalendarPlus } from "lucide-react";
import { haptics } from "@/lib/haptics";

interface CornerFabsProps {
  onAddPerson: () => void;
  onLogEncounter: () => void;
}

/**
 * Bottom-right FAB stack per Visual Brief §4.2.
 * - Primary FAB (red): Add Person.
 * - Secondary FAB (dark surface): Quick Actions menu. For M2 Phase A this
 *   surfaces just Log Encounter; more actions land alongside the new Home
 *   screen and voice-memo feature.
 */
export function CornerFabs({ onAddPerson, onLogEncounter }: CornerFabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Quick Actions menu — slides up above the secondary FAB */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="corner-fabs fixed z-40 bottom-24 right-4 flex flex-col items-end gap-3 safe-bottom">
        <AnimatePresence>
          {menuOpen && (
            <motion.button
              key="log-encounter"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                haptics.light();
                setMenuOpen(false);
                onLogEncounter();
              }}
              className="flex items-center gap-2 px-3.5 h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-foreground text-sm font-medium active:scale-[0.98] transition-transform"
            >
              <CalendarPlus className="w-4 h-4" strokeWidth={1.75} />
              Log encounter
            </motion.button>
          )}
        </AnimatePresence>

        {/* Secondary FAB — Quick Actions */}
        <button
          onClick={() => {
            haptics.light();
            setMenuOpen((v) => !v);
          }}
          aria-label="Quick actions"
          aria-expanded={menuOpen}
          className="w-12 h-12 rounded-full bg-surface-2 border border-[hsl(0_0%_100%/0.12)] flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          <Zap className="w-5 h-5" strokeWidth={1.75} />
        </button>

        {/* Primary FAB — Add Person */}
        <button
          onClick={() => {
            haptics.medium();
            onAddPerson();
          }}
          aria-label="Add new person"
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.35)" }}
        >
          <Plus className="w-7 h-7" strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
