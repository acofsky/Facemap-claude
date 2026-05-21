import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, CalendarPlus, Sparkles, Mic } from 'lucide-react';

interface QuickActionsMenuProps {
  open: boolean;
  onClose: () => void;
  onAddPerson: () => void;
  onLogEncounter: () => void;
  onNewEvent: () => void;
  onVoiceAdd: () => void;
}

/**
 * Radial bubble cluster opened by the FAB in the frosted bottom nav.
 * Bubbles spring up and out from the FAB position in a fan shape.
 * The FAB itself is owned by AppLayout so it sits naturally inside the
 * frosted nav's grid cell; this component is just the menu overlay.
 */
export function QuickActionsMenu({
  open,
  onAddPerson,
  onLogEncounter,
  onNewEvent,
  onVoiceAdd,
}: QuickActionsMenuProps) {
  return (
    <div
      className="corner-fabs fixed z-50 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{
        // FAB center sits ~46px above the nav's bottom edge (nav bottom: 12 + safe-bottom,
        // nav height 68, FAB margin-top -22). Place this anchor at that point so the
        // bubbles fan out symmetrically around the FAB.
        bottom: 'calc(env(safe-area-inset-bottom) + 56px)',
      }}
    >
      <div className="relative pointer-events-auto">
        <AnimatePresence>
          {open && (
            <>
              <Bubble
                key="add-person"
                icon={UserPlus}
                label="Add Person"
                offsetX={-104}
                offsetY={-60}
                delay={0.0}
                onClick={onAddPerson}
              />
              <Bubble
                key="log-encounter"
                icon={CalendarPlus}
                label="Log Encounter"
                offsetX={-60}
                offsetY={-104}
                delay={0.04}
                onClick={onLogEncounter}
              />
              <Bubble
                key="voice-add"
                icon={Mic}
                label="Voice add"
                offsetX={60}
                offsetY={-104}
                delay={0.08}
                onClick={onVoiceAdd}
              />
              <Bubble
                key="new-event"
                icon={Sparkles}
                label="New Event"
                offsetX={104}
                offsetY={-60}
                delay={0.12}
                onClick={onNewEvent}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
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
      <span className="glass-pill w-12 h-12 rounded-full !px-0 flex items-center justify-center text-foreground active:scale-95 transition-transform">
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </span>
      <span className="glass-pill !h-auto !py-1 !px-2 text-[10px] whitespace-nowrap">
        {label}
      </span>
    </motion.button>
  );
}
