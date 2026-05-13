import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useSmartClusters } from '@/hooks/use-smart-clusters';
import { EventSheet } from '@/components/EventSheet';
import type { SmartCluster } from '@/lib/smart-circle';

/**
 * Smart Circle suggestion banner — Surface 1 of the engine, on HOME-01.
 * Renders the highest-priority pending cluster. "Yes" opens the EventSheet
 * pre-populated with the suggested name + matched member IDs. "Dismiss"
 * permanently silences that cluster.
 */
export function SmartCircleBanner() {
  const { clusters, dismiss } = useSmartClusters();
  const [creating, setCreating] = useState<SmartCluster | null>(null);
  const top = clusters[0];

  return (
    <>
      <AnimatePresence>
        {top && (
          <motion.div
            key={top.fingerprint}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.25 }}
            className="rounded-lg bg-surface-2 border border-[hsl(0_0%_100%/0.12)] p-3.5"
          >
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" strokeWidth={1.75} />
              <p className="flex-1 text-[13px] text-foreground leading-snug">
                Looks like you met a few people at{' '}
                <span className="text-primary font-semibold">{top.suggestedName}</span> — create an Event?
              </p>
            </div>
            <div className="flex items-center justify-end gap-4 mt-2 pl-6">
              <button
                onClick={() => dismiss(top.fingerprint)}
                className="text-[12px] font-medium text-muted-text active:text-foreground transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => setCreating(top)}
                className="text-[12px] font-semibold text-primary active:opacity-80 transition-opacity"
              >
                Yes, create
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {creating && (
        <EventSheet
          onClose={() => {
            // After the user either saves or cancels, dismiss the suggestion so it
            // doesn't immediately resurface; if they hit Cancel that's a soft "no".
            dismiss(creating.fingerprint);
            setCreating(null);
          }}
          suggestion={{
            name: creating.suggestedName,
            startDate: creating.startDate,
            endDate: creating.endDate,
            personIds: creating.personIds,
          }}
        />
      )}
    </>
  );
}
