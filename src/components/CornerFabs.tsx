import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Zap, CalendarPlus } from "lucide-react";
import { haptics } from "@/lib/haptics";

interface CornerFabsProps {
  onAddPerson: () => void;
  onLogEncounter: () => void;
}

/**
 * Bottom-center FAB cluster.
 *
 * Lived in the corner originally (Visual Brief §4.2) but covered list-row
 * chevrons on Home; the user asked to centre it. Now sits just above the
 * tab bar, horizontally centred: primary red + for Add Person on the
 * right, surface-2 Zap for Quick Actions on the left. The Quick Actions
 * menu pops upward from the Zap button.
 *
 * Component name + `.corner-fabs` className preserved so the existing
 * keyboard-open slide-off rule in index.css keeps applying without
 * needing a new selector.
 */
export function CornerFabs({ onAddPerson, onLogEncounter }: CornerFabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Tap-out overlay for the Quick Actions menu */}
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

      <div
        className="corner-fabs fixed z-50 left-1/2 -translate-x-1/2 flex items-center gap-3"
        style={{
          // Sit just above the bottom tab bar. Nav bar height is h-16 (64 px)
          // plus the safe-area inset; the extra 0.75 rem keeps a small gap.
          bottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)',
        }}
      >
        {/* Quick Actions menu — pops up from the Zap button. Anchored to
            the parent cluster so it stays centred even on narrow widths. */}
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
              className="absolute left-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-foreground text-sm font-medium active:scale-[0.98] transition-transform"
              style={{ bottom: 'calc(100% + 12px)' }}
            >
              <CalendarPlus className="w-4 h-4" strokeWidth={1.75} />
              Log encounter
            </motion.button>
          )}
        </AnimatePresence>

        {/* Secondary — Quick Actions */}
        <button
          onClick={() => {
            haptics.light();
            setMenuOpen((v) => !v);
          }}
          aria-label="Quick actions"
          aria-expanded={menuOpen}
          className="w-11 h-11 rounded-full bg-surface-2 border border-[hsl(0_0%_100%/0.12)] flex items-center justify-center text-foreground active:scale-95 transition-transform"
        >
          <Zap className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* Primary — Add Person */}
        <button
          onClick={() => {
            haptics.medium();
            onAddPerson();
          }}
          aria-label="Add new person"
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
          style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.35)" }}
        >
          <Plus className="w-6 h-6" strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
