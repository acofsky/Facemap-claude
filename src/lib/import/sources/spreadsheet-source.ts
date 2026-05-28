import Papa from 'papaparse';
import type { CandidateDraft } from '../types';

const NAME_HEADERS = [
  'full name', 'name', 'person', 'contact', 'who', 'their name',
];
const FIRST_NAME_HEADERS = ['first name', 'first', 'given name', 'firstname'];
const LAST_NAME_HEADERS = ['last name', 'last', 'family name', 'surname', 'lastname'];
const EMAIL_HEADERS = ['email', 'e-mail', 'email address', 'mail'];
const PHONE_HEADERS = ['phone', 'phone number', 'mobile', 'cell', 'cellphone', 'telephone', 'tel'];
const COMPANY_HEADERS = ['company', 'organization', 'org', 'employer', 'workplace', 'business'];
const TITLE_HEADERS = ['title', 'position', 'role', 'job title', 'job', 'occupation'];

const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;

interface ColumnMap {
  name?: number;
  firstName?: number;
  lastName?: number;
  email?: number;
  phone?: number;
  company?: number;
  title?: number;
  /** Every column that isn't an identity field — folded into context. */
  notes: number[];
}

interface ParseResult {
  drafts: CandidateDraft[];
  columnMap: ColumnMap;
  unmappedRows: number;
}

export class SpreadsheetParseError extends Error {
  constructor(message: string, public readonly code: 'NO_NAME_COL' | 'EMPTY' | 'BAD_FORMAT') {
    super(message);
  }
}

/**
 * Parse a user-supplied CSV/TSV of people. Header row is required.
 * Heuristically maps columns to name/email/phone/company/title; everything
 * else becomes context for the AI ranker (so a "Notes" or "Conversation"
 * column flows through as bullets on the candidate card).
 *
 * Throws `SpreadsheetParseError` with code 'NO_NAME_COL' if we can't find
 * a name column — the caller surfaces a guidance toast.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  if (!text.trim()) {
    throw new SpreadsheetParseError('That file looks empty.', 'EMPTY');
  }

  // TSV gets a leg up if the file extension or sniff suggests it; Papa's
  // default delimiter detection handles standard CSVs fine.
  const isTSV = file.name.toLowerCase().endsWith('.tsv');

  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
    delimiter: isTSV ? '\t' : undefined,
  });

  const rows = result.data;
  if (!rows || rows.length < 2) {
    throw new SpreadsheetParseError('No data rows found. The first row should be column headers.', 'EMPTY');
  }

  const headers = rows[0].map((h) => (h || '').trim());
  const columnMap = mapColumns(headers, rows.slice(1, 11));

  if (columnMap.name === undefined && columnMap.firstName === undefined) {
    throw new SpreadsheetParseError(
      "Couldn't find a Name column. Make sure your spreadsheet's first row has a header like 'Name' or 'Full Name'.",
      'NO_NAME_COL',
    );
  }

  const drafts: CandidateDraft[] = [];
  let unmappedRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = extractName(row, columnMap);
    if (!name) { unmappedRows++; continue; }

    const email = pickCell(row, columnMap.email) || sniffEmail(row, columnMap);
    const phone = pickCell(row, columnMap.phone) || sniffPhone(row, columnMap);
    const company = pickCell(row, columnMap.company);
    const title = pickCell(row, columnMap.title);
    const context = buildContext(headers, row, columnMap);

    drafts.push({
      source: 'spreadsheet',
      name,
      email,
      phone,
      company,
      title,
      context,
      raw: { file_name: file.name, row_index: i, raw_row: row },
    });
  }

  return { drafts, columnMap, unmappedRows };
}

function mapColumns(headers: string[], sampleRows: string[][]): ColumnMap {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const map: ColumnMap = { notes: [] };

  const matchFirst = (candidates: string[]): number | undefined => {
    for (const c of candidates) {
      const idx = normalized.indexOf(c);
      if (idx !== -1) return idx;
    }
    // Looser "header includes phrase" pass.
    for (let i = 0; i < normalized.length; i++) {
      if (candidates.some((c) => normalized[i].includes(c))) return i;
    }
    return undefined;
  };

  // Check First/Last Name pair FIRST. "First Name" loosely matches "name"
  // via substring, which would pollute the single-name search otherwise. If
  // both halves of the pair exist we treat them as the source of truth and
  // skip the single-name lookup entirely.
  map.firstName = matchFirst(FIRST_NAME_HEADERS);
  map.lastName = matchFirst(LAST_NAME_HEADERS);
  if (map.firstName === undefined || map.lastName === undefined) {
    map.firstName = undefined;
    map.lastName = undefined;
    map.name = matchFirst(NAME_HEADERS);
  }
  map.email = matchFirst(EMAIL_HEADERS);
  map.phone = matchFirst(PHONE_HEADERS);
  map.company = matchFirst(COMPANY_HEADERS);
  map.title = matchFirst(TITLE_HEADERS);

  // If we still don't have name but a column happens to look like full
  // names in the sample, use that.
  if (map.name === undefined && map.firstName === undefined) {
    for (let i = 0; i < headers.length; i++) {
      const looksLikeName = sampleRows.every((r) => {
        const v = (r[i] || '').trim();
        if (!v) return true;
        return /^[A-Za-z][A-Za-z'.\- ]{1,40}$/.test(v) && v.includes(' ');
      });
      if (looksLikeName && sampleRows.some((r) => (r[i] || '').trim())) {
        map.name = i;
        break;
      }
    }
  }

  const claimed = new Set<number>();
  [map.name, map.firstName, map.lastName, map.email, map.phone, map.company, map.title].forEach((idx) => {
    if (typeof idx === 'number') claimed.add(idx);
  });
  for (let i = 0; i < headers.length; i++) {
    if (!claimed.has(i)) map.notes.push(i);
  }

  return map;
}

function extractName(row: string[], map: ColumnMap): string {
  if (map.name !== undefined) return (row[map.name] || '').trim();
  const first = map.firstName !== undefined ? (row[map.firstName] || '').trim() : '';
  const last = map.lastName !== undefined ? (row[map.lastName] || '').trim() : '';
  return [first, last].filter(Boolean).join(' ').trim();
}

function pickCell(row: string[], idx: number | undefined): string | undefined {
  if (idx === undefined) return undefined;
  const v = (row[idx] || '').trim();
  return v || undefined;
}

function sniffEmail(row: string[], map: ColumnMap): string | undefined {
  const exclude = new Set([map.name, map.firstName, map.lastName, map.email, map.phone, map.company, map.title]);
  for (let i = 0; i < row.length; i++) {
    if (exclude.has(i)) continue;
    const v = (row[i] || '').trim();
    if (v && EMAIL_RE.test(v)) return v;
  }
  return undefined;
}

function sniffPhone(row: string[], map: ColumnMap): string | undefined {
  const exclude = new Set([map.name, map.firstName, map.lastName, map.email, map.phone, map.company, map.title]);
  for (let i = 0; i < row.length; i++) {
    if (exclude.has(i)) continue;
    const v = (row[i] || '').trim();
    if (v && PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 7) return v;
  }
  return undefined;
}

function buildContext(headers: string[], row: string[], map: ColumnMap): string | undefined {
  const parts: string[] = [];
  for (const idx of map.notes) {
    const header = (headers[idx] || '').trim();
    const value = (row[idx] || '').trim();
    if (!value) continue;
    // Trim absurdly long cells so the AI prompt doesn't blow past its budget.
    const v = value.length > 240 ? value.slice(0, 240).trimEnd() + '…' : value;
    parts.push(header ? `${header}: ${v}` : v);
  }
  if (parts.length === 0) return undefined;
  const joined = parts.join(' · ');
  return joined.length > 800 ? joined.slice(0, 800).trimEnd() + '…' : joined;
}
