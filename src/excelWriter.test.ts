import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from './excelWriter';
import { parseVnDate } from './dates';
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
  baseRow({ no: 1, discardingDate: new Date(Date.UTC(2026, 5, 10)), pid: 'M: 1\nF: 2', orDate: new Date(Date.UTC(2025, 2, 4)), freezeDate: 'N/A', embryo: 9, location: 'E19G9T', numCassettes: 2, numTec: 6, tecColor: 'Yellow', caseRowSpan: 1 }),
  baseRow({ no: 2, discardingDate: new Date(Date.UTC(2026, 5, 10)), pid: 'M: 3\nF: 4', orDate: new Date(Date.UTC(2025, 5, 9)), freezeDate: 'N/A', embryo: 2, location: 'E23G6T', cassetteColor: 'Green', tecColor: 'Yellow', isCaseStart: true, caseRowSpan: 2 }),
  baseRow({ location: 'E25G1G', cassetteColor: 'Orange', tecColor: 'Green', isCaseStart: false, caseRowSpan: 2 }),
  // sperm (266) case
  baseRow({
    no: 3, discardingDate: new Date(Date.UTC(2026, 5, 10)), pid: 'M: 2410022517', orDate: 'N/A', freezeDate: new Date(Date.UTC(2025, 2, 17)),
    sperm: 1, location: 'TS4-G2D', numCassettes: 'N/A', cassetteColor: 'N/A', numTec: 'N/A', tecColor: 'N/A',
    numContainers: 1, containerType: 'Tec', containerColor: 'Yellow', origin: 'XUẤT TINH', note: 'MÃ NHTT: 2414418',
  }),
];

describe('buildWorkbook', () => {
  it('produces the expected header, merges, formats, dropdowns, total', async () => {
    const wb = await buildWorkbook(rows);
    const buf = await wb.xlsx.writeBuffer();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buf);
    const ws = wb2.getWorksheet('Trang tính1')!;
    expect(ws).toBeTruthy();
    expect(ws.getCell('A1').value).toBe('No.');
    expect(ws.getCell('D1').value).toBe('OR Date');
    expect(ws.getCell('E1').value).toBe('Freeze date');
    expect(ws.getCell('F1').value).toBe('Sample');
    expect(ws.getCell('H2').value).toBe('Sperm');
    expect(ws.getCell('N1').value).toBe('Number of containers');
    expect(ws.getCell('O1').value).toBe('Container type');
    expect(ws.getCell('P1').value).toBe('Container color');
    expect(ws.getCell('Q1').value).toContain('Loại mẫu hủy');
    expect(ws.getCell('R1').value).toContain('Ghi chú');
    expect(ws.getCell('S1').value).toBe('Compliance');

    const merges: string[] = (ws as any).model.merges;
    expect(merges).toEqual(expect.arrayContaining(['F1:H1', 'S1:U1', 'A1:A2']));
    // multi-location case (rows 4-5) merges col A vertically
    expect(merges).toEqual(expect.arrayContaining(['A4:A5']));

    expect(ws.getCell('B3').numFmt.toLowerCase()).toContain('dd');
    expect(ws.getCell('C3').value).toContain('\n');
    expect(ws.getCell('E3').value).toBe('N/A');           // embryo case: no freeze date
    expect(ws.getCell('N3').value).toBe('N/A');           // embryo case: no containers
    expect(ws.getCell('S3').dataValidation?.type).toBe('list');
    expect(ws.getCell('S3').dataValidation?.formulae).toEqual(['"N/A,Yes,No"']);
    // Compliance is auditor-entered: empty values leave the cell blank.
    expect(ws.getCell('S3').value ?? '').toBe('');
    expect(ws.getCell('U3').value ?? '').toBe('');

    // sperm case on row 6
    expect(ws.getCell('D6').value).toBe('N/A');           // no OR date
    expect(ws.getCell('E6').numFmt.toLowerCase()).toContain('dd'); // freeze date is a real date
    expect(ws.getCell('H6').value).toBe(1);
    expect(ws.getCell('J6').value).toBe('N/A');
    expect(ws.getCell('N6').value).toBe(1);
    expect(ws.getCell('O6').value).toBe('Tec');
    expect(ws.getCell('P6').value).toBe('Yellow');
    expect(ws.getCell('Q6').value).toBe('XUẤT TINH');
    expect(ws.getCell('R6').value).toBe('MÃ NHTT: 2414418');

    // Total row after 4 data rows (rows 3-6) → row 7
    expect(ws.getCell('E7').value).toBe('Total');
    const f7 = ws.getCell('F7').value as any;
    expect(f7.formula ?? f7).toContain('SUM(F3:F6)');
    const h7 = ws.getCell('H7').value as any;
    expect(h7.formula ?? h7).toContain('SUM(H3:H6)');
  });
});

// Regression: PDF 2410195189 said "Ngày trữ tinh trùng 14/11/2025" but the
// workbook displayed 13/11/2025 — parseVnDate produced local midnight while
// ExcelJS converts Dates to serials with UTC math, shifting UTC+ users back a day.
describe('date integrity across XLSX serialization', () => {
  const utcDay = (d: Date) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];

  it('keeps parsed dates on the same calendar day through a write/load round-trip', async () => {
    const wb = await buildWorkbook([baseRow({
      no: 1, discardingDate: parseVnDate('10/06/2026'), pid: 'M: 2410195189', orDate: 'N/A',
      freezeDate: parseVnDate('14/11/2025'), sperm: 1, location: 'TS2-G7-C12B',
    })]);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(await wb.xlsx.writeBuffer());
    const ws = wb2.getWorksheet('Trang tính1')!;
    // Excel displays the UTC calendar day of the stored serial.
    expect(utcDay(ws.getCell('E3').value as Date)).toEqual([2025, 11, 14]);
    expect(utcDay(ws.getCell('B3').value as Date)).toEqual([2026, 6, 10]);
  });

  it('rejects non-UTC-midnight dates instead of silently shifting the displayed day', async () => {
    const wrongConvention = new Date(Date.UTC(2025, 10, 13, 17, 0)); // == local midnight 14/11 on UTC+7
    await expect(buildWorkbook([baseRow({ no: 1, freezeDate: wrongConvention })]))
      .rejects.toThrow(/UTC midnight/);
  });
});
