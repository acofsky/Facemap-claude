import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks/use-scroll-lock';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive uses Primary Red on the confirm button. */
  destructive?: boolean;
  /** While true, the confirm button shows a spinner and both buttons are
   *  disabled. Lets the dialog signal "the work is happening" instead of
   *  vanishing immediately and leaving the user staring at a frozen screen
   *  while a slow mutation runs. */
  loading?: boolean;
  /** Label shown next to the spinner while loading. Defaults to the
   *  confirmLabel + "…". */
  loadingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Branded replacement for window.confirm. iOS WebView's native confirm
 * dialog feels foreign and can't be styled; this matches v2 surfaces
 * (surface-2 card, hairline border, 8px button radius, single red moment
 * on destructive confirm).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading = false,
  loadingLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
            onClick={loading ? undefined : onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            // Centering is folded into framer-motion's animate values
            // because the `scale` keyframe sets `transform` inline and
            // would otherwise wipe Tailwind's `-translate-x-1/2
            // -translate-y-1/2` — the dialog ended up with its top-left
            // corner at viewport centre and clipped off the right edge.
            initial={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', damping: 24, stiffness: 360 }}
            className="fixed left-1/2 top-1/2 z-[81] w-[min(86vw,360px)] rounded-xl bg-surface-2 border border-[hsl(0_0%_100%/0.12)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl text-foreground tracking-[-0.02em]">
              {title}
            </h3>
            {description && (
              <p className="mt-2 text-[13px] text-muted-text leading-relaxed">
                {description}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 h-11 rounded-md bg-surface-1 border border-[hsl(0_0%_100%/0.12)] text-foreground text-[14px] font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'flex-1 h-11 rounded-md text-[14px] font-semibold active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2 disabled:opacity-80',
                  destructive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-foreground text-background',
                )}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? (loadingLabel ?? `${confirmLabel}…`) : confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
