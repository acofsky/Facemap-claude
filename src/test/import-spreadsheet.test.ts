import { describe, it, expect } from 'vitest';
import { parseSpreadsheetFile, SpreadsheetParseError } from '@/lib/import/sources/spreadsheet-source';

function makeFile(text: string, name = 'test.csv', type = 'text/csv'): File {
  // JSDOM's File doesn't implement .text() — patch in a real implementation
  // backed by the source string so the source module can call it normally.
  const file = new File([text], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  return file;
}

describe('parseSpreadsheetFile', () => {
  it('parses a vanilla Name/Email/Notes CSV and maps notes into misc_notes', async () => {
    const csv = [
      'Name,Email,Notes',
      'Alex Chen,alex@example.com,Met at design conf. Wants to chat about ML.',
      'Jamie Park,jamie@x.io,Knows Sarah from yoga',
    ].join('\n');
    const { drafts } = await parseSpreadsheetFile(makeFile(csv));
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      source: 'spreadsheet',
      name: 'Alex Chen',
      email: 'alex@example.com',
    });
    expect(drafts[0].mappedFields?.misc_notes).toContain('Met at design conf');
    // Mapped columns shouldn't double up in the AI context blob.
    expect(drafts[0].context).toBeUndefined();
  });

  it('joins First Name + Last Name when no single name column exists', async () => {
    const csv = [
      'First Name,Last Name,Company,Conversation',
      'Mira,Khan,Stripe,Talked about her new fintech role',
    ].join('\n');
    const { drafts } = await parseSpreadsheetFile(makeFile(csv));
    expect(drafts[0].name).toBe('Mira Khan');
    expect(drafts[0].company).toBe('Stripe');
    // 'Conversation' is mapped to misc_notes.
    expect(drafts[0].mappedFields?.misc_notes).toContain('Talked about her new fintech role');
  });

  it('maps rich free-text columns to specific Person fields', async () => {
    const csv = [
      'Name,How I met them,Where met,Description,Important notes,Who they know',
      'Sam Liu,Coffee chat through Jamie,Tribeca rooftop,Tall blond beard,VP at small fintech,Knows Mira Khan',
    ].join('\n');
    const { drafts } = await parseSpreadsheetFile(makeFile(csv));
    expect(drafts[0].mappedFields).toMatchObject({
      how_we_met: 'Coffee chat through Jamie',
      where_when: 'Tribeca rooftop',
      physical_description: 'Tall blond beard',
      important_info: 'VP at small fintech',
      known_people_notes: 'Knows Mira Khan',
    });
    // Nothing left over.
    expect(drafts[0].context).toBeUndefined();
  });

  it('identifies misnamed identity columns by fuzzy header', async () => {
    const csv = [
      'Person,Job Title,Mobile,Email Address',
      'Sam Liu,Founder,415-555-9821,sam@liu.dev',
    ].join('\n');
    const { drafts } = await parseSpreadsheetFile(makeFile(csv));
    expect(drafts[0]).toMatchObject({
      name: 'Sam Liu',
      title: 'Founder',
      phone: '415-555-9821',
      email: 'sam@liu.dev',
    });
  });

  it('throws NO_NAME_COL when no name column can be inferred', async () => {
    const csv = [
      'Random,Email,Phone',
      '12345,foo@bar.com,555-1234',
    ].join('\n');
    await expect(parseSpreadsheetFile(makeFile(csv))).rejects.toThrow(SpreadsheetParseError);
  });

  it('skips rows missing a name and reports them', async () => {
    const csv = [
      'Name,Notes',
      'Alex,one',
      ',two',
      'Jamie,three',
    ].join('\n');
    const { drafts, unmappedRows } = await parseSpreadsheetFile(makeFile(csv));
    expect(drafts).toHaveLength(2);
    expect(unmappedRows).toBe(1);
  });

  it('parses TSV files using tab delimiter', async () => {
    const tsv = 'Name\tEmail\tConvo\nAlex\talex@x.com\thi\n';
    const { drafts } = await parseSpreadsheetFile(makeFile(tsv, 'people.tsv', 'text/tab-separated-values'));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].email).toBe('alex@x.com');
    expect(drafts[0].mappedFields?.misc_notes).toBe('hi');
  });

  it('caps long context cells from truly unmapped columns', async () => {
    const long = 'a'.repeat(500);
    const csv = `Name,Random Column,Random2\nAlex,${long},short\n`;
    const { drafts } = await parseSpreadsheetFile(makeFile(csv));
    // Random Column and Random2 don't match any identity header, so they
    // fall into context — and context's per-cell cap should kick in.
    expect(drafts[0].context).toBeDefined();
    expect(drafts[0].context!.length).toBeLessThan(800);
  });
});
