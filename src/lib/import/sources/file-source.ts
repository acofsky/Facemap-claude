import { parseSpreadsheetFile, SpreadsheetParseError } from './spreadsheet-source';
import { gatherPhotoOcrCandidates } from './photo-ocr-source';
import type { CandidateDraft } from '../types';

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Dispatch a user-picked file to the right parser by sniffing its MIME
 * type / extension. Spreadsheets, Excel workbooks, and photos all enter
 * via the same "A file" source card in the import picker so the user has
 * one button instead of three.
 *
 * Returned drafts carry the accurate per-row source id ('spreadsheet' or
 * 'photo_ocr') for provenance — the merged picker entry is purely a UI
 * concept.
 */
export async function gatherFileCandidates(file: File): Promise<CandidateDraft[]> {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif|bmp)$/.test(name)) {
    return gatherPhotoOcrCandidates(file);
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    throw new UnsupportedFileError(
      'PDF imports are coming soon. For now, save the table as CSV or Excel.',
    );
  }

  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel'
  ) {
    const csv = await excelToCsv(file);
    // Wrap the converted text back in a File so parseSpreadsheetFile can
    // reuse its existing API without growing a second entry point.
    const synthetic = new File([csv], file.name.replace(/\.(xlsx?|xls)$/i, '.csv'), {
      type: 'text/csv',
    });
    const { drafts } = await parseSpreadsheetFile(synthetic);
    return drafts;
  }

  // Default: try CSV/TSV.
  const { drafts } = await parseSpreadsheetFile(file);
  return drafts;
}

async function excelToCsv(file: File): Promise<string> {
  // Lazy-import SheetJS — it's ~300KB minified. Loading it on the import
  // route would punish every other tab.
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new SpreadsheetParseError('That Excel file has no sheets.', 'EMPTY');
  }
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}

export { SpreadsheetParseError };
