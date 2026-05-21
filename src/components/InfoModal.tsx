import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useScrollLock } from '@/hooks/use-scroll-lock';

interface InfoModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

/**
 * Centered, dismiss-only popup for short explanatory copy — the "(i)"
 * affordance pattern. Closes on the X button or a backdrop tap. Matches
 * ConfirmDialog's centering technique (transform is folded into the
 * framer-motion animate values so the scale keyframe can't wipe it).
 */
export function InfoModal({ open, title, children, onClose }: InfoModalProps) {
  useScrollLock(open);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 360 }}
            className="glass fixed left-1/2 top-1/2 z-[61] w-[min(86vw,360px)] p-5"
            style={{ background: 'rgba(20, 14, 14, 0.92)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl text-foreground tracking-[-0.02em]">
                {title}
              </h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 -mr-1.5 -mt-1 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="mt-2 text-[13px] text-muted-text leading-relaxed space-y-2">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
