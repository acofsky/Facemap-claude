import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserPlus, CalendarPlus, Sparkles, Mic } from 'lucide-react';
import { haptics } from '@/lib/haptics';

interface MainButtonProps {
  onAddPerson: () => void;
  onLogEncounter: () => void;
  onNewEvent: () => void;
  onVoiceAdd: () => void;
}

/**
 * Central FAB in the bottom tab bar. Tapping the main + opens a radial
 * cluster of action bubbles around it (Add Person, Log Encounter, New
 * Event). The main glyph rotates 45° to read as a close (×) affordance
 * while the menu is open. A dimming overlay backs the bubbles so the
 * page below recedes.
 *
 * Renders as a floating element above the nav cell — the parent gives
 * it a flex-1 slot in the bar; this button is absolutely positioned
 * inside that slot so its raised pose doesn't push the other tab
 * cells around.
 */
export function MainButton({ onAddPerson, onLogEncounter, onNewEvent, onVoiceAdd }: MainButtonProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const handle = (fn: () => void) => () => {
    haptics.medium();
    setOpen(false);
    fn();
  };

  return (
    <>
      {/* Dimming overlay backs the bubble cluster while open. Sits above
          page content and the bottom nav (z-45 > nav z-40) but below the
          bubbles and main button (z-50). */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            className="fixed inset-0 z-[45] bg-black/55"
          />
        )}
      </AnimatePresence>

      {/* Bubble cluster + main button live in a fixed container anchored at
          the bottom-center of the screen, just above the nav bar. */}
      <div
        className="corner-fabs fixed z-50 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          // Center of the main button sits on the top edge of the nav bar.
          bottom: 'calc(env(safe-area-inset-bottom) + 1.75rem)',
        }}
      >
        {/* Absolute-positioned bubble nest. Centered on the main button. */}
        <div className="relative pointer-events-auto">
          <AnimatePresence>
            {open && (
              <>
                <Bubble
                  key="add-person"
                  icon={UserPlus}
                  label="Add Person"
                  /* Far left */
                  offsetX={-104}
                  offsetY={-60}
                  delay={0.0}
                  onClick={handle(onAddPerson)}
                />
                <Bubble
                  key="log-encounter"
                  icon={CalendarPlus}
                  label="Log Encounter"
                  /* Upper-left */
                  offsetX={-60}
                  offsetY={-104}
                  delay={0.04}
                  onClick={handle(onLogEncounter)}
                />
                <Bubble
                  key="voice-add"
                  icon={Mic}
                  label="Voice add"
                  /* Upper-right — primary thumb position */
                  offsetX={60}
                  offsetY={-104}
                  delay={0.08}
                  onClick={handle(onVoiceAdd)}
                />
                <Bubble
                  key="new-event"
                  icon={Sparkles}
                  label="New Event"
                  /* Far right */
                  offsetX={104}
                  offsetY={-60}
                  delay={0.12}
                  onClick={handle(onNewEvent)}
                />
              </>
            )}
          </AnimatePresence>

          {/* Main button — the only button visible when collapsed. */}
          <button
            onClick={() => {
              haptics.light();
              setOpen((v) => !v);
            }}
            aria-label={open ? 'Close quick actions' : 'Open quick actions'}
            aria-expanded={open}
            className="w-[60px] h-[60px] rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
            style={{ boxShadow: '0 6px 18px hsl(var(--primary) / 0.4)' }}
          >
            <Plus
              className="w-7 h-7 transition-transform duration-200"
              strokeWidth={2}
              style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>
      </div>
    </>
  );
}

function Bubble({
  icon: Icon,
  label,
  offsetX,
  offsetY,
  delay,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  offsetX: number;
  offsetY: number;
  delay: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.4, x: '-50%', y: 0 }}
      animate={{ opacity: 1, scale: 1, x: `calc(-50% + ${offsetX}px)`, y: offsetY }}
      exit={{ opacity: 0, scale: 0.4, x: '-50%', y: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 320, delay }}
      className="absolute left-1/2 top-0 flex flex-col items-center gap-1"
    >
      <span
        className="w-12 h-12 rounded-full bg-surface-2 border border-[hsl(0_0%_100%/0.18)] flex items-center justify-center text-foreground active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 12px hsl(0 0% 0% / 0.55)' }}
      >
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </span>
      <span className="text-[10px] font-medium text-foreground whitespace-nowrap px-1.5 py-0.5 rounded-sm bg-surface-2 border border-[hsl(0_0%_100%/0.12)]">
        {label}
      </span>
    </motion.button>
  );
}
