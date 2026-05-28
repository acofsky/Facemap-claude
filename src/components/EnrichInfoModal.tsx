import { Sparkles } from 'lucide-react';
import { InfoModal } from '@/components/InfoModal';

interface EnrichInfoModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shared explainer for the AI-enrichment placeholders. Surfaced from the
 * Profile teaser row, the People page "Enrich all" button, and any
 * "(i)" affordance next to either. No action — enrichment is a Premium
 * feature that hasn't shipped yet.
 */
export function EnrichInfoModal({ open, onClose }: EnrichInfoModalProps) {
  return (
    <InfoModal open={open} title="AI Enrichment" onClose={onClose}>
      <p>
        Enrichment uses AI web search to deepen each contact's profile beyond
        what your import source gave us — recent role changes, public bio,
        company background, mutual connections.
      </p>
      <p>
        It runs per-person, costs more compute than the import scan, and is
        coming as a Premium feature. The import flow today still pulls
        everything your sources expose.
      </p>
      <div className="mt-2 pt-2 border-t border-[hsl(0_0%_100%/0.08)] flex items-center gap-1.5 text-[12px] text-[hsl(var(--foreground)/0.5)]">
        <Sparkles className="w-3 h-3" strokeWidth={1.75} />
        Membr Premium — coming soon
      </div>
    </InfoModal>
  );
}
