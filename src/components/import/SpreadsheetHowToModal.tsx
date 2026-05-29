import { InfoModal } from '@/components/InfoModal';

interface SpreadsheetHowToModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Explainer for the merged "A file" source. Covers what file types are
 * accepted, what we look for inside spreadsheets, and how to get Excel /
 * Numbers / Google Sheets to spit out something this can read.
 */
export function SpreadsheetHowToModal({ open, onClose }: SpreadsheetHowToModalProps) {
  return (
    <InfoModal open={open} title="Upload a file" onClose={onClose}>
      <p>
        Drop a <span className="text-foreground">CSV, Excel, or image</span>.
        We'll route it automatically:
      </p>
      <ul className="list-disc list-inside text-[12px] space-y-1">
        <li><span className="text-foreground">CSV / TSV / Excel (.xlsx):</span> first row should be column headers, each row after is one person. We auto-detect Name, Email, Phone, Company, Title; every other column (Notes, "Last conversation," etc.) becomes context AI uses to pick your best matches.</li>
        <li><span className="text-foreground">Photo:</span> AI reads visible names from badges, captions, slides. No face recognition — only people whose name is written somewhere in the frame.</li>
        <li><span className="text-foreground">PDF:</span> coming soon.</li>
      </ul>
      <div className="mt-2 pt-2 border-t border-[hsl(0_0%_100%/0.08)] space-y-1.5">
        <p className="text-foreground text-[12px] font-semibold uppercase tracking-wider">
          Exporting a spreadsheet
        </p>
        <ul className="list-disc list-inside text-[12px] space-y-0.5">
          <li><span className="text-foreground">Excel:</span> Save As → .xlsx or CSV UTF-8 (both work)</li>
          <li><span className="text-foreground">Numbers:</span> File → Export To → CSV</li>
          <li><span className="text-foreground">Google Sheets:</span> File → Download → CSV or .xlsx</li>
        </ul>
      </div>
    </InfoModal>
  );
}
