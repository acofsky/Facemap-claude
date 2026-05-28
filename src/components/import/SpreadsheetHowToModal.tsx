import { InfoModal } from '@/components/InfoModal';

interface SpreadsheetHowToModalProps {
  open: boolean;
  onClose: () => void;
}

export function SpreadsheetHowToModal({ open, onClose }: SpreadsheetHowToModalProps) {
  return (
    <InfoModal open={open} title="Upload a spreadsheet" onClose={onClose}>
      <p>
        Drop a CSV (or TSV) of people. The first row should be column headers;
        each row after is one person.
      </p>
      <p>
        We auto-detect columns by name:
        <span className="text-foreground"> Name</span>,
        <span className="text-foreground"> Email</span>,
        <span className="text-foreground"> Phone</span>,
        <span className="text-foreground"> Company</span>,
        <span className="text-foreground"> Title</span>.
        Anything else — Notes, "Last conversation," "What we talked about" —
        flows into the AI ranker so each candidate gets context-aware bullets.
      </p>
      <div className="mt-2 pt-2 border-t border-[hsl(0_0%_100%/0.08)] space-y-1.5">
        <p className="text-foreground text-[12px] font-semibold uppercase tracking-wider">
          Saving as CSV
        </p>
        <ul className="list-disc list-inside text-[12px] space-y-0.5">
          <li><span className="text-foreground">Excel:</span> File → Save As → CSV UTF-8</li>
          <li><span className="text-foreground">Numbers:</span> File → Export To → CSV</li>
          <li><span className="text-foreground">Google Sheets:</span> File → Download → CSV</li>
        </ul>
      </div>
    </InfoModal>
  );
}
