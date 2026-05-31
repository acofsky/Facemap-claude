import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useScrollLock } from '@/hooks/use-scroll-lock';
import { haptics } from '@/lib/haptics';
import { submitFeedback } from '@/lib/import/storage';

interface FeedbackSheetProps {
  open: boolean;
  /** App version string to tag the submission with (for triage). */
  appVersion?: string;
  onClose: () => void;
}

/**
 * "How'd we do?" feedback popup for the Smart Import review screen. Free
 * text → saved to the Supabase `feedback` table (no email provider wired).
 * Opened manually from a small link on the review screen.
 */
export function FeedbackSheet({ open, appVersion, onClose }: FeedbackSheetProps) {
  useScrollLock(open);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await submitFeedback({ message: trimmed, appVersion });
      haptics.medium();
      toast.success('Thanks — got it. Really appreciate you.');
      setMessage('');
      onClose();
    } catch {
      toast.error('Could not send that. Mind trying once more?');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[78] bg-black/70"
        onClick={sending ? undefined : onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 360 }}
        className="kb-aware-sheet glass-sheet fixed left-0 right-0 mx-auto w-full max-w-md rounded-t-2xl z-[79] flex flex-col"
        style={{ background: 'rgba(20, 14, 14, 0.94)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[hsl(0_0%_100%/0.08)]">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--foreground)/0.55)] font-semibold">
              Smart Import
            </div>
            <h2 className="text-2xl font-display text-foreground tracking-[-0.02em]">
              How&apos;d we do<span className="text-primary">?</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            className="w-8 h-8 rounded-md flex items-center justify-center text-[hsl(var(--foreground)/0.55)] disabled:opacity-50"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 pt-3 pb-4 space-y-3">
          <p className="text-[13px] text-[hsl(var(--foreground)/0.65)] leading-relaxed">
            Smart Import is a brand-new feature and we&apos;d genuinely love to know how it
            worked for you — what landed, what felt off, anything you wish it did. It goes
            straight to the team.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Tell us what you think…"
            className="glass-input w-full p-3 text-[14px] leading-relaxed resize-none"
          />
        </div>

        <div className="px-5 py-3 border-t border-[hsl(0_0%_100%/0.08)] safe-bottom">
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2} />}
            {sending ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
