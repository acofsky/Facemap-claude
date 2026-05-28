import Papa from 'papaparse';
import type { CandidateDraft, MappedPersonFields } from '../types';

const NAME_HEADERS = [
  'full name', 'name', 'person', 'contact', 'who', 'their name',
];
const FIRST_NAME_HEADERS = ['first name', 'first', 'given name', 'firstname'];
const LAST_NAME_HEADERS = ['last name', 'last', 'family name', 'surname', 'lastname'];
const EMAIL_HEADERS = ['email', 'e-mail', 'email address', 'mail'];
const PHONE_HEADERS = ['phone', 'phone number', 'mobile', 'cell', 'cellphone', 'telephone', 'tel'];
const COMPANY_HEADERS = ['company', 'organization', 'org', 'employer', 'workplace', 'business'];
const TITLE_HEADERS = ['title', 'position', 'role', 'job title', 'job', 'occupation'];

// Person free-text fields. Each list is checked in `matchFirst` order —
// place specific phrases before short fuzzy ones so they win the substring
// fallback (e.g., 'how we met' must be tested before 'met').
const HOW_WE_MET_HEADERS = [
  'how we met', 'how met', 'how i met', 'how did we meet',
  'introduced by', 'introduction', 'met via', 'met through', 'origin',
];
const WHERE_WHEN_HEADERS = [
  'where we met', 'where met', 'where', 'place', 'venue', 'location',
  'when we met', 'when met', 'when', 'context',
];
const PHYSICAL_HEADERS = [
  'physical description', 'appearance', 'looks', 'looks like', 'description',
  'physical', 'what they look like',
];
const MISC_NOTES_HEADERS = [
  'about', 'notes', 'note', 'misc', 'about them', 'comments',
  'conversation', 'convo', 'last convo', 'last conversation',
  'what we talked about', 'discussion', 'details',
];
const IMPORTANT_INFO_HEADERS = [
  'important', 'important info', 'important notes', 'background',
  'context', 'info', 'key info', 'priority',
];
const KNOWN_PEOPLE_HEADERS = [
  'who they know', 'knows', 'mutual', 'mutual friends', 'connections',
  'mutuals', 'related to',
];

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
  howWeMet?: number;
  whereWhen?: number;
  physical?: number;
  miscNotes?: number;
  importantInfo?: number;
  knownPeople?: number;
  /** Columns the heuristic couldn't categorize — folded into context. */
  context: number[];
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
 *
 * The heuristic maps as many columns as possible directly onto Person
 * fields (`how_we_met`, `where_when`, `misc_notes`, etc.) so the import
 * promotes into rich Person rows instead of dumping everything into a
 * single bullet blob. Truly unmapped columns become per-row `context`
 * for the AI ranker.
 *
 * Throws `SpreadsheetParseError` with code 'NO_NAME_COL' if we can't find
 * a name column — the caller surfaces a guidance toast.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  if (!text.trim()) {
    throw new SpreadsheetParseError('That file looks empty.', 'EMPTY');
  }

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

    const mappedFields: MappedPersonFields = {};
    const setIf = (key: keyof MappedPersonFields, val: string | undefined) => {
      if (val) mappedFields[key] = val;
    };
    setIf('how_we_met', pickCell(row, columnMap.howWeMet));
    setIf('where_when', pickCell(row, columnMap.whereWhen));
    setIf('physical_description', pickCell(row, columnMap.physical));
    setIf('misc_notes', pickCell(row, columnMap.miscNotes));
    setIf('important_info', pickCell(row, columnMap.importantInfo));
    setIf('known_people_notes', pickCell(row, columnMap.knownPeople));

    const context = buildContext(headers, row, columnMap);

    drafts.push({
      source: 'spreadsheet',
      name,
      email,
      phone,
      company,
      title,
      mappedFields: Object.keys(mappedFields).length > 0 ? mappedFields : undefined,
      context,
      raw: { file_name: file.name, row_index: i, raw_row: row },
    });
  }

  return { drafts, columnMap, unmappedRows };
}

function mapColumns(headers: string[], sampleRows: string[][]): ColumnMap {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const claimed = new Set<number>();
  const map: ColumnMap = { context: [] };

  const matchFirst = (candidates: string[]): number | undefined => {
    // Exact match first — most reliable.
    for (const c of candidates) {
      const idx = normalized.indexOf(c);
      if (idx !== -1 && !claimed.has(idx)) return idx;
    }
    // Looser "header includes phrase" pass.
    for (let i = 0; i < normalized.length; i++) {
      if (claimed.has(i)) continue;
      if (candidates.some((c) => normalized[i].includes(c))) return i;
    }
    return undefined;
  };

  const claim = (key: keyof Omit<ColumnMap, 'context'>, candidates: string[]) => {
    const idx = matchFirst(candidates);
    if (idx !== undefined) {
      map[key] = idx;
      claimed.add(idx);
    }
  };

  // Identity columns first — they have the strictest matching.
  // First/Last name pair check before single Name lookup so "First Name"
  // doesn't get swallowed by the loose "name" substring rule.
  const firstIdx = matchFirst(FIRST_NAME_HEADERS);
  const lastIdx = matchFirst(LAST_NAME_HEADERS);
  if (firstIdx !== undefined && lastIdx !== undefined) {
    map.firstName = firstIdx;
    map.lastName = lastIdx;
    claimed.add(firstIdx);
    claimed.add(lastIdx);
  } else {
    claim('name', NAME_HEADERS);
  }
  claim('email', EMAIL_HEADERS);
  claim('phone', PHONE_HEADERS);
  claim('company', COMPANY_HEADERS);
  claim('title', TITLE_HEADERS);

  // Person free-text fields. Long phrases first within each list (see
  // ordering in the constants above) so substring fallback is safe.
  claim('howWeMet', HOW_WE_MET_HEADERS);
  claim('whereWhen', WHERE_WHEN_HEADERS);
  claim('physical', PHYSICAL_HEADERS);
  // important_info before misc_notes — "Important notes" should beat the
  // generic "notes" substring match. Plain "Notes" still falls through to
  // misc_notes after the importantInfo pass leaves it unclaimed.
  claim('importantInfo', IMPORTANT_INFO_HEADERS);
  claim('miscNotes', MISC_NOTES_HEADERS);
  claim('knownPeople', KNOWN_PEOPLE_HEADERS);

  // If we still don't have name but a column happens to look like full
  // names in the sample, use that.
  if (map.name === undefined && map.firstName === undefined) {
    for (let i = 0; i < headers.length; i++) {
      if (claimed.has(i)) continue;
      const looksLikeName = sampleRows.every((r) => {
        const v = (r[i] || '').trim();
        if (!v) return true;
        return /^[A-Za-z][A-Za-z'.\- ]{1,40}$/.test(v) && v.includes(' ');
      });
      if (looksLikeName && sampleRows.some((r) => (r[i] || '').trim())) {
        map.name = i;
        claimed.add(i);
        break;
      }
    }
  }

  // Everything still unclaimed becomes context for the AI ranker.
  for (let i = 0; i < headers.length; i++) {
    if (!claimed.has(i)) map.context.push(i);
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

function identityCols(map: ColumnMap): Array<number | undefined> {
  return [
    map.name, map.firstName, map.lastName, map.email, map.phone,
    map.company, map.title, map.howWeMet, map.whereWhen, map.physical,
    map.miscNotes, map.importantInfo, map.knownPeople,
  ];
}

function sniffEmail(row: string[], map: ColumnMap): string | undefined {
  const exclude = new Set(identityCols(map));
  for (let i = 0; i < row.length; i++) {
    if (exclude.has(i)) continue;
    const v = (row[i] || '').trim();
    if (v && EMAIL_RE.test(v)) return v;
  }
  return undefined;
}

function sniffPhone(row: string[], map: ColumnMap): string | undefined {
  const exclude = new Set(identityCols(map));
  for (let i = 0; i < row.length; i++) {
    if (exclude.has(i)) continue;
    const v = (row[i] || '').trim();
    if (v && PHONE_RE.test(v) && v.replace(/\D/g, '').length >= 7) return v;
  }
  return undefined;
}

function buildContext(headers: string[], row: string[], map: ColumnMap): string | undefined {
  const parts: string[] = [];
  for (const idx of map.context) {
    const header = (headers[idx] || '').trim();
    const value = (row[idx] || '').trim();
    if (!value) continue;
    const v = value.length > 240 ? value.slice(0, 240).trimEnd() + '…' : value;
    parts.push(header ? `${header}: ${v}` : v);
  }
  if (parts.length === 0) return undefined;
  const joined = parts.join(' · ');
  return joined.length > 800 ? joined.slice(0, 800).trimEnd() + '…' : joined;
}
