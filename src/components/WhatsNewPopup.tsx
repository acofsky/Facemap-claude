import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Upload, Users, X } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { openFeedback } from '@/lib/feedback';
import { useScrollLock } from '@/hooks/use-scroll-lock';

/**
 * Bump this string whenever there's a new round of "what's new" to show.
 * The seen value is stored under WHATS_NEW_SEEN_KEY; a mismatch re-triggers
 * the popup once per install. (See the gate in Index.tsx.)
 */
export const WHATS_NEW_VERSION = 'smart-import-2026-06';
export const WHATS_NEW_SEEN_KEY = 'membr_whats_new_seen';

interface WhatsNewPopupProps {
  open: boolean;
  /** Open the Smart Import wizard. */
  onTryImport: () => void;
  /** Dismiss (marks this version seen). */
  onClose: () => void;
}

export function WhatsNewPopup({ open, onTryImport, onClose }: WhatsNewPopupProps) {
  useScrollLock(open);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 360 }}
            className="glass fixed left-1/2 top-1/2 z-[81] w-[min(88vw,380px)] p-5"
            style={{ background: 'rgba(20, 14, 14, 0.94)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} /> What's new
              </span>
              <button
                onClick={onClose}
                aria-label="Close"
                className="-mt-1 -mr-1 p-1.5 rounded-md text-[hsl(var(--foreground)/0.55)]"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <h2 className="font-display text-2xl text-foreground leading-tight tracking-[-0.02em] mb-3">
              Bring your people in<span className="text-primary">.</span>
            </h2>

            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-8 h-8 rounded-md tile-red flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4 text-white" strokeWidth={1.75} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Smart Import</div>
                  <p className="text-[13px] text-[hsl(var(--foreground)/0.65)] leading-relaxed">
                    Pull people in from your Contacts, a LinkedIn export, a spreadsheet, or even a
                    photo of a name badge — and let AI surface the ones who matter to you.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-8 h-8 rounded-md glass-pill flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-foreground" strokeWidth={1.75} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Tag people in encounters</div>
                  <p className="text-[13px] text-[hsl(var(--foreground)/0.65)] leading-relaxed">
                    Log who else was there, edit past encounters, and it shows up on everyone's
                    profile.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[13px] font-display-italic text-[hsl(var(--foreground)/0.7)] mt-4">
              Give it a try — and tell us what you think.
            </p>

            <button
              onClick={() => {
                haptics.medium();
                onTryImport();
              }}
              className="mt-4 w-full h-[52px] rounded-2xl bg-primary text-primary-foreground text-[15px] font-semibold shadow-[0_8px_24px_rgba(224,48,48,0.35)] active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" strokeWidth={1.75} /> Try Smart Import
            </button>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  haptics.selection();
                  openFeedback();
                }}
                className="flex-1 h-11 rounded-md bg-surface-2 border border-[hsl(0_0%_100%/0.12)] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
              >
                Send feedback
              </button>
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.12)] text-sm font-medium text-foreground active:scale-[0.98] transition-transform"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
