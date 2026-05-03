import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Sparkles, Copy, Check } from 'lucide-react';
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
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-card rounded-t-3xl z-50 warm-shadow-lg max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-6 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl text-foreground">Brief: {personName}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating your brief...</p>
            </div>
          ) : brief ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">{brief}</pre>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-12">No brief available.</p>
          )}
        </div>

        {brief && !loading && (
          <div className="p-6 pt-3 border-t border-border">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy brief</>}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
