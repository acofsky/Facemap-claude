import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Wand2, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/70 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-secondary rounded-t-sheet-top z-50 max-h-[88vh] flex flex-col border-t border-border"
        style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.8), 0 0 0 1px hsl(0 75% 53% / 0.08)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="icon-tile icon-tile-red !w-9 !h-9 flex-shrink-0">
              <Wand2 className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground leading-tight">Meeting brief</p>
              <h2 className="font-display text-foreground leading-tight truncate" style={{ fontSize: '22px' }}>{personName}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.75} />
              <p className="text-[13px] text-muted-foreground">Generating your brief...</p>
            </div>
          ) : brief ? (
            <pre className="whitespace-pre-wrap font-sans text-[15px] text-foreground leading-relaxed">{brief}</pre>
          ) : (
            <p className="text-[14px] text-muted-foreground italic text-center py-12">No brief available.</p>
          )}
        </div>

        {brief && !loading && (
          <div className="px-5 pt-3 pb-5 border-t border-border">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-button bg-card border border-border text-foreground text-[14px] font-medium hover:border-foreground/20 active:scale-[0.99] transition-all"
            >
              {copied ? <><Check className="w-4 h-4 text-success" strokeWidth={2} /> Copied</> : <><Copy className="w-4 h-4" strokeWidth={1.75} /> Copy brief</>}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
