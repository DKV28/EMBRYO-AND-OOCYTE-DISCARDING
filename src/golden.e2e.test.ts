// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractPdfItems, parseRecordFromItems } from './pdfParser';
import { transform } from './transform';

const dir = join(process.cwd(), 'samples') + '/';
// Anonymized fixture names — keep patient names out of source control.
// Rename your local sample PDFs to match (see samples/README.md).
const FILES = {
  s1: 'sample-1-single-location.pdf',
  s2: 'sample-2-grouped-cassettes.pdf',
  s3: 'sample-3-two-locations.pdf',
};
const haveAll = Object.values(FILES).every(f => existsSync(dir + f));

describe.skipIf(!haveAll)('golden master (real PDFs)', () => {
  it('reproduces desired_output cases 2–4 (renumbered 1–3)', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const records = [];
    for (const f of [FILES.s1, FILES.s2, FILES.s3]) {
      const data = new Uint8Array(readFileSync(dir + f));
      const items = await extractPdfItems(data, pdfjs);
      records.push(parseRecordFromItems(items, f));
    }
    const { rows } = transform(records, new Date(Date.UTC(2026, 5, 10)));

    // Sample 1: 1 row. (PID/OR-date assertions omitted — those are real PHI.)
    expect(rows[0]).toMatchObject({ no: 1, location: 'E6G1T', numCassettes: 3, cassetteColor: 'Red', numTec: 3, tecColor: 'Green', embryo: 3 });
    // Sample 2: 1 row
    const s2 = rows.find(r => r.location === 'E19G9T')!;
    expect(s2).toMatchObject({ no: 2, numCassettes: 2, cassetteColor: 'Red', numTec: 6, tecColor: 'Yellow', embryo: 9 });
    // Sample 3: 2 rows
    const s3a = rows.find(r => r.location === 'E23G6T')!;
    const s3b = rows.find(r => r.location === 'E25G1G')!;
    expect(s3a).toMatchObject({ no: 3, numCassettes: 1, cassetteColor: 'Green', numTec: 1, tecColor: 'Yellow', embryo: 2, caseRowSpan: 2 });
    expect(s3b).toMatchObject({ no: null, numCassettes: 1, cassetteColor: 'Orange', numTec: 1, tecColor: 'Green' });
  });
});
