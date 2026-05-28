import Papa from 'papaparse';
import type { CandidateDraft } from '../types';

/**
 * Parse a `Connections.csv` exported from LinkedIn. The file has a few
 * leading "Notes" preamble lines before the actual CSV header — Papa with
 * `skipEmptyLines` plus the `header` flag tolerates this when we strip the
 * preamble manually first.
 *
 * Standard columns (LinkedIn 2024 export):
 *   First Name, Last Name, URL, Email Address, Company, Position, Connected On
 */
export async function parseLinkedInCsv(file: File): Promise<CandidateDraft[]> {
  const text = await file.text();
  const csv = stripLinkedInPreamble(text);

  const drafts: CandidateDraft[] = [];

  await new Promise<void>((resolve, reject) => {
    Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        for (const row of result.data) {
          const name = [row['First Name'], row['Last Name']].filter(Boolean).join(' ').trim();
          if (!name) continue;
          const url = (row['URL'] || '').trim() || undefined;
          const email = (row['Email Address'] || '').trim() || undefined;
          const company = (row['Company'] || '').trim() || undefined;
          const title = (row['Position'] || '').trim() || undefined;
          const connectedOn = (row['Connected On'] || '').trim() || undefined;
          drafts.push({
            source: 'linkedin',
            name,
            email,
            company,
            title,
            raw: {
              linkedin_url: url,
              connected_on: connectedOn,
            },
          });
        }
        resolve();
      },
      error: (err) => reject(err),
    });
  });

  return drafts;
}

/**
 * LinkedIn's export prepends 3-5 lines of explanatory text before the
 * actual header row. The real CSV starts with "First Name,Last Name,...".
 * Find that line and drop everything above it. Files that already start at
 * the header pass through unchanged.
 */
function stripLinkedInPreamble(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].startsWith('First Name')) {
      return lines.slice(i).join('\n');
    }
  }
  return text;
}
