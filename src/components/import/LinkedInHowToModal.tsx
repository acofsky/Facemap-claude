import { InfoModal } from '@/components/InfoModal';

interface LinkedInHowToModalProps {
  open: boolean;
  onClose: () => void;
}

export function LinkedInHowToModal({ open, onClose }: LinkedInHowToModalProps) {
  return (
    <InfoModal open={open} title="Export from LinkedIn" onClose={onClose}>
      <p>On LinkedIn web (not the app):</p>
      <ol className="list-decimal list-inside space-y-1.5 text-[13px]">
        <li>
          Click <span className="text-foreground">Me</span> in the top-right →
          {' '}<span className="text-foreground">Settings &amp; Privacy</span>
        </li>
        <li>
          Open the <span className="text-foreground">Data Privacy</span> tab →
          {' '}<span className="text-foreground">Get a copy of your data</span>
        </li>
        <li>
          Choose <span className="text-foreground">Download larger data archive</span>
          {' '}(this includes your connections; LinkedIn emails you a download link in ~24 hours)
        </li>
        <li>
          Open the ZIP and find <span className="text-foreground">Connections.csv</span> —
          {' '}drop that file here
        </li>
      </ol>
      <div className="mt-2 pt-2 border-t border-[hsl(0_0%_100%/0.08)]">
        <p className="text-[12px] text-[hsl(var(--foreground)/0.55)]">
          <span className="text-foreground">Faster route:</span>{' '}
          on the same page, look for <span className="text-foreground">Want something in particular?</span>
          {' '}If a <span className="text-foreground">Connections</span> checkbox appears
          there, picking only that delivers the CSV in ~10 minutes.
        </p>
      </div>
    </InfoModal>
  );
}
