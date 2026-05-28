import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, RotateCcw, Sparkles, X } from 'lucide-react';
import { useScrollLock } from '@/hooks/use-scroll-lock';

interface RankResultModalProps {
  open: boolean;
  /** 'failed' = AI call errored; 'no-matches' = all scores below threshold; null = closed. */
  kind: 'failed' | 'no-matches' | null;
  filterText: string;
  onShowAll: () => void;
  onRestart: () => void;
  onRetry?: () => void;
  onClose: () => void;
}

/**
 * Displayed at the end of the rank step when either the AI call itself
 * failed or the filter excluded everyone we pulled. Replaces a toast so
 * the failure is unambiguous and the user gets a clear path forward
 * (retry, show everything anyway, or restart with different criteria).
 */
export function RankResultModal({
  open,
  kind,
  filterText,
  onShowAll,
  onRestart,
  onRetry,
  onClose,
}: RankResultModalProps) {
  useScrollLock(open && !!kind);

  const failed = kind === 'failed';
  const title = failed ? "Couldn't rank with AI" : 'No close matches';
  const body = failed
    ? 'The AI ranking call didn’t come back. You can try again, or skip ranking and review every candidate as-is.'
    : filterText
      ? `Nothing in your imports clearly matches "${truncate(filterText, 80)}". You can still browse everything, restart with different criteria, or close and try a different source.`
      : 'No candidates were ranked. You can browse everything, restart, or close.';

  return (
    <AnimatePresence>
      {open && kind && (
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
            className="glass fixed left-1/2 top-1/2 z-[81] w-[min(86vw,380px)] p-5"
            style={{ background: 'rgba(20, 14, 14, 0.94)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${failed ? 'bg-[hsl(0_85%_55%_/_0.18)] text-primary' : 'bg-[hsl(0_0%_100%/0.08)] text-foreground'}`}>
                  {failed ? <AlertCircle className="w-4 h-4" strokeWidth={1.75} /> : <Sparkles className="w-4 h-4" strokeWidth={1.75} />}
                </div>
                <h3 className="font-display text-[18px] text-foreground tracking-[-0.02em] leading-tight">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 -mr-1.5 -mt-1 rounded-md text-[hsl(var(--foreground)/0.55)] active:scale-95 transition-transform"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <p className="mt-3 text-[13px] text-[hsl(var(--foreground)/0.7)] leading-relaxed">
              {body}
            </p>
            <div className="mt-4 space-y-2">
              {failed && onRetry && (
                <button
                  onClick={onRetry}
                  className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
                  Try again
                </button>
              )}
              <button
                onClick={onShowAll}
                className={`w-full h-11 rounded-2xl text-[14px] font-semibold active:scale-[0.98] transition-transform ${failed && onRetry ? 'bg-[hsl(0_0%_100%/0.08)] text-foreground' : 'bg-primary text-primary-foreground'}`}
              >
                Browse all anyway
              </button>
              <button
                onClick={onRestart}
                className="w-full h-11 rounded-2xl bg-[hsl(0_0%_100%/0.06)] text-[hsl(var(--foreground)/0.8)] text-[14px] font-medium active:scale-[0.98] transition-transform"
              >
                Restart with different criteria
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}
