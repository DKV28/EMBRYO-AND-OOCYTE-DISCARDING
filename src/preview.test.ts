import { describe, it, expect } from 'vitest';
import { renderPreview } from './preview';
import type { OutputRow } from './types';

function baseRow(over: Partial<OutputRow>): OutputRow {
  return {
    no: null, discardingDate: null, pid: null, orDate: null, freezeDate: null,
    embryo: null, oocyte: null, sperm: null,
    location: 'X', numCassettes: 1, cassetteColor: 'Red', numTec: 1, tecColor: 'Green',
    numContainers: 'N/A', containerType: 'N/A', containerColor: 'N/A', origin: 'N/A', note: 'N/A',
    storageCompliance: '', cfCompliance: '', discardingProcedure: '', signaturesCompliance: '',
    isCaseStart: true, caseRowSpan: 1, ...over,
  };
}

const rows: OutputRow[] = [
  baseRow({ no: 1, pid: 'M: 3\nF: 4', orDate: new Date(Date.UTC(2025, 5, 9)), embryo: 2, location: 'E23G6T', cassetteColor: 'Green', tecColor: 'Yellow', caseRowSpan: 2 }),
  baseRow({ location: 'E25G1G', cassetteColor: 'Orange', tecColor: 'Green', isCaseStart: false, caseRowSpan: 2 }),
];

const spermRow = baseRow({
  no: 2, pid: 'M: 2410022517', orDate: 'N/A',
  sperm: 1, location: 'TS4-G2D', numCassettes: 'N/A', cassetteColor: 'N/A', numTec: 'N/A', tecColor: 'N/A',
});

describe('renderPreview', () => {
  it('renders patient cell with rowspan and both location rows', () => {
    const table = renderPreview(rows);
    const bodyRows = table.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    const noCell = bodyRows[0].querySelector('td')!;
    expect(noCell.getAttribute('rowspan')).toBe('2');
    expect(table.textContent).toContain('E23G6T');
    expect(table.textContent).toContain('E25G1G');
    expect(table.textContent).toContain('09/06/2025'); // OR date formatted
  });

  it('renders the template header columns (15-col layout)', () => {
    const table = renderPreview(rows);
    const heads = Array.from(table.querySelectorAll('thead th')).map(t => t.textContent);
    expect(heads).toEqual(expect.arrayContaining([
      'No.', 'PID', 'OR Date', 'Sample', 'Embryo', 'Oocyte', 'Sperm', 'Location',
      'Number of cassettes', 'Compliance', 'Storage', 'CF', 'Discarding', 'Signatures',
    ]));
    // dropped columns must NOT appear anymore
    expect(heads).not.toContain('Freeze date');
    expect(heads).not.toContain('Containers');
    expect(heads).not.toContain('Ghi chú');
  });

  it('renders a sperm row in the same table: N/A dates and cassette/tec cells', () => {
    const table = renderPreview([spermRow]);
    const cells = Array.from(table.querySelectorAll('tbody td')).map(t => t.textContent);
    expect(cells).toContain('TS4-G2D');
    expect(cells).toContain('1');                                  // sperm count
    expect(cells.filter(c => c === 'N/A').length).toBeGreaterThanOrEqual(5); // OR date + 4 cassette/tec cols
  });

  it('renders four compliance columns as N/A/Yes/No dropdowns, default empty', () => {
    const table = renderPreview(rows);
    const selects = table.querySelectorAll('tbody select');
    expect(selects).toHaveLength(8); // 4 compliance dropdowns × 2 location rows
    const first = selects[0] as HTMLSelectElement;
    expect(Array.from(first.options).map(o => o.value)).toEqual(['', 'N/A', 'Yes', 'No']);
    expect(first.value).toBe(''); // default empty — auditor fills it in
  });

  it('writes dropdown selections back to the row object (incl. Signatures)', () => {
    const local: OutputRow[] = [baseRow({ ...rows[0], caseRowSpan: 1 })];
    const table = renderPreview(local);
    const selects = table.querySelectorAll('tbody select');
    const storage = selects[0] as HTMLSelectElement;
    storage.value = 'No'; storage.dispatchEvent(new Event('change'));
    const signatures = selects[3] as HTMLSelectElement;
    signatures.value = 'Yes'; signatures.dispatchEvent(new Event('change'));
    expect(local[0].storageCompliance).toBe('No');
    expect(local[0].signaturesCompliance).toBe('Yes');
  });
});
