import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIBadge } from '@/components/AIBadge';
import { DragHandle } from '@/components/DragHandle';
import { haptics } from '@/lib/haptics';

interface MeetingBriefModalProps {
  personId: string;
  personName: string;
  onClose: () => void;
}

export function MeetingBriefModal({ personId, personName, onClose }: MeetingBriefModalProps) {
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const generate = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('meeting-brief', {
          body: { personId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setBrief(data?.brief || '');
      } catch (e: any) {
        toast.error(e.message || 'Failed to generate brief');
        setBrief('');
      } finally {
        setLoading(false);
      }
    };
    generate();
  }, [personId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {/* z-[60] keeps the modal above the centre FAB cluster (z-50).
          MeetingBriefModal is rendered inside <main>, which is earlier
          in DOM than the FAB, so equal z-index loses the tie. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 400 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) {
            haptics.light();
            onClose();
          }
        }}
        className="kb-aware-sheet fixed left-0 right-0 mx-auto w-full max-w-md bg-surface-2 rounded-t-2xl border-t border-[hsl(0_0%_100%/0.12)] z-[60] flex flex-col safe-bottom"
      >
        <DragHandle />
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.75} />
            <h2 className="font-display text-xl text-foreground tracking-[-0.02em]">Brief: {personName}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-[hsl(0_0%_100%/0.06)] text-muted-text">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 pb-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-text">Generating your brief…</p>
            </div>
          ) : brief ? (
            <>
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">{brief}</pre>
              <div className="mt-3">
                <AIBadge feature="brief" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-text italic text-center py-12">No brief available.</p>
          )}
        </div>

        {brief && !loading && (
          <div className="px-5 pt-3 pb-5 border-t border-[hsl(0_0%_100%/0.08)]">
            <button
              onClick={handleCopy}
              className="w-full h-[52px] inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] transition-transform"
            >
              {copied ? <><Check className="w-4 h-4" strokeWidth={1.75} /> Copied!</> : <><Copy className="w-4 h-4" strokeWidth={1.75} /> Copy brief</>}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
