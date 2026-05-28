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
  it('parses a vanilla Name/Email/Notes CSV', async () => {
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
    expect(drafts[0].context).toContain('Notes: Met at design conf');
  });

  it('joins First Name + Last Name when no single name column exists', async () => {
    const csv = [
      'First Name,Last Name,Company,Conversation',
      'Mira,Khan,Stripe,Talked about her new fintech role',
    ].join('\n');
    const { drafts } = await parseSpreadsheetFile(makeFile(csv));
    expect(drafts[0].name).toBe('Mira Khan');
    expect(drafts[0].company).toBe('Stripe');
    expect(drafts[0].context).toContain('Conversation: Talked about her new fintech role');
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
    expect(drafts[0].context).toContain('Convo: hi');
  });

  it('caps long notes cells', async () => {
    const long = 'a'.repeat(500);
    const csv = `Name,Notes\nAlex,${long}\n`;
    const { drafts } = await parseSpreadsheetFile(makeFile(csv));
    expect(drafts[0].context!.length).toBeLessThan(280);
    expect(drafts[0].context).toMatch(/…$/);
  });
});
