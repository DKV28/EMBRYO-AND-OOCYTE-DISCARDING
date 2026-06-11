import { describe, it, expect } from 'vitest';
import { renderPreview } from './preview';
import type { OutputRow } from './types';

function baseRow(over: Partial<OutputRow>): OutputRow {
  return {
    no: null, discardingDate: null, pid: null, orDate: null, freezeDate: null,
    embryo: null, oocyte: null, sperm: null,
    location: 'X', numCassettes: 1, cassetteColor: 'Red', numTec: 1, tecColor: 'Green',
    numContainers: 'N/A', containerType: 'N/A', containerColor: 'N/A', origin: 'N/A', note: 'N/A',
    storageCompliance: '', cfCompliance: '', discardingProcedure: '',
    isCaseStart: true, caseRowSpan: 1, ...over,
  };
}

const rows: OutputRow[] = [
  baseRow({ no: 1, discardingDate: new Date(Date.UTC(2026, 5, 10)), pid: 'M: 3\nF: 4', orDate: new Date(Date.UTC(2025, 5, 9)), freezeDate: 'N/A', embryo: 2, location: 'E23G6T', cassetteColor: 'Green', tecColor: 'Yellow', caseRowSpan: 2 }),
  baseRow({ location: 'E25G1G', cassetteColor: 'Orange', tecColor: 'Green', isCaseStart: false, caseRowSpan: 2 }),
];

const spermRow = baseRow({
  no: 2, discardingDate: new Date(Date.UTC(2026, 5, 10)), pid: 'M: 2410022517', orDate: 'N/A', freezeDate: new Date(Date.UTC(2025, 2, 17)),
  sperm: 1, location: 'TS4-G2D', numCassettes: 'N/A', cassetteColor: 'N/A', numTec: 'N/A', tecColor: 'N/A',
  numContainers: 1, containerType: 'Tec', containerColor: 'Yellow', origin: 'XUẤT TINH', note: 'MÃ NHTT: 2414418',
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

  it('renders the new sperm-form columns in the header', () => {
    const table = renderPreview(rows);
    const heads = Array.from(table.querySelectorAll('thead th')).map(t => t.textContent);
    expect(heads).toContain('Freeze date');
    expect(heads).toContain('Containers');
    expect(heads).toContain('Container type');
    expect(heads).toContain('Container color');
    expect(heads).toContain('Loại mẫu hủy');
    expect(heads).toContain('Ghi chú');
  });

  it('renders a sperm row: N/A dates and cassette cells, container info, origin, note', () => {
    const table = renderPreview([spermRow]);
    const cells = Array.from(table.querySelectorAll('tbody td')).map(t => t.textContent);
    expect(cells).toContain('TS4-G2D');
    expect(cells).toContain('17/03/2025');     // freeze date
    expect(cells).toContain('Tec');
    expect(cells).toContain('XUẤT TINH');
    expect(cells).toContain('MÃ NHTT: 2414418');
    expect(cells.filter(c => c === 'N/A').length).toBeGreaterThanOrEqual(5); // OR date + 4 cassette/tec cols
  });

  it('renders the three compliance columns as N/A/Yes/No dropdowns, default empty', () => {
    const table = renderPreview(rows);
    const selects = table.querySelectorAll('tbody select');
    expect(selects).toHaveLength(6); // 3 compliance dropdowns × 2 location rows
    const first = selects[0] as HTMLSelectElement;
    expect(Array.from(first.options).map(o => o.value)).toEqual(['', 'N/A', 'Yes', 'No']);
    expect(first.value).toBe(''); // default empty — auditor fills it in
  });

  it('writes a dropdown selection back to the row object', () => {
    const local: OutputRow[] = [{ ...rows[0], storageCompliance: '', cfCompliance: '', discardingProcedure: '' }];
    const table = renderPreview(local);
    const sel = table.querySelector('tbody select') as HTMLSelectElement; // storage compliance
    sel.value = 'No';
    sel.dispatchEvent(new Event('change'));
    expect(local[0].storageCompliance).toBe('No');
  });
});
