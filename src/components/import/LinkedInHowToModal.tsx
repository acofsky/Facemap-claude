import { InfoModal } from '@/components/InfoModal';

interface LinkedInHowToModalProps {
  open: boolean;
  onClose: () => void;
}

export function LinkedInHowToModal({ open, onClose }: LinkedInHowToModalProps) {
  return (
    <InfoModal open={open} title="Export from LinkedIn" onClose={onClose}>
      <ol className="list-decimal list-inside space-y-1.5 text-[13px]">
        <li>On LinkedIn web: <span className="text-foreground">Me → Settings &amp; Privacy</span></li>
        <li>
          <span className="text-foreground">Data Privacy</span> → "Get a copy of your data"
        </li>
        <li>Pick "Connections" (or "Want something in particular?") and request the archive</li>
        <li>LinkedIn emails you a download link in ~10 minutes</li>
        <li>The ZIP contains <span className="text-foreground">Connections.csv</span> — drop it here</li>
      </ol>
      <p className="text-[12px] text-[hsl(var(--foreground)/0.55)] mt-2">
        The CSV holds names, titles, companies, and connection dates. Profile photos aren't included in the export.
      </p>
    </InfoModal>
  );
}
