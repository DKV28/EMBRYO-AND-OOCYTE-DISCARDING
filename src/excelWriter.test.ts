import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from './excelWriter';
import { parseVnDate } from './dates';
import type { OutputRow } from './types';

function baseRow(over: Partial<OutputRow>): OutputRow {
  return {
    caseId: 'C', no: null, discardingDate: null, pid: null, orDate: null, freezeDate: null,
    embryo: null, oocyte: null, sperm: null,
    location: 'X', numCassettes: 1, cassetteColor: 'Red', numTec: 1, tecColor: 'Green',
    numContainers: 'N/A', containerType: 'N/A', containerColor: 'N/A', origin: 'N/A', note: 'N/A',
    storageCompliance: '', cfCompliance: '', discardingProcedure: '', signaturesCompliance: '',
    isCaseStart: true, caseRowSpan: 1, ...over,
  };
}

const rows: OutputRow[] = [
  baseRow({ no: 1, pid: 'M: 1\nF: 2', orDate: new Date(Date.UTC(2025, 2, 4)), embryo: 9, location: 'E19G9T', numCassettes: 2, numTec: 6, tecColor: 'Yellow', caseRowSpan: 1 }),
  baseRow({ no: 2, pid: 'M: 3\nF: 4', orDate: new Date(Date.UTC(2025, 5, 9)), embryo: 2, location: 'E23G6T', cassetteColor: 'Green', tecColor: 'Yellow', isCaseStart: true, caseRowSpan: 2 }),
  baseRow({ location: 'E25G1G', cassetteColor: 'Orange', tecColor: 'Green', isCaseStart: false, caseRowSpan: 2 }),
  // sperm (266) case: same table, cassette/tec N/A
  baseRow({
    no: 3, pid: 'M: 2410022517', orDate: 'N/A',
    sperm: 1, location: 'TS4-G2D', numCassettes: 'N/A', cassetteColor: 'N/A', numTec: 'N/A', tecColor: 'N/A',
  }),
];

describe('buildWorkbook', () => {
  it('produces the template header, merges, formats, dropdowns, total (15 cols)', async () => {
    const wb = await buildWorkbook(rows);
    const buf = await wb.xlsx.writeBuffer();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buf);
    const ws = wb2.getWorksheet('Trang tính1')!;
    expect(ws).toBeTruthy();
    expect(ws.getCell('A1').value).toBe('No.');
    expect(ws.getCell('B1').value).toBe('PID');
    expect(ws.getCell('C1').value).toBe('OR Date');
    expect(ws.getCell('D1').value).toBe('Sample');
    expect(ws.getCell('F2').value).toBe('Sperm');
    expect(ws.getCell('G1').value).toBe('Location');
    expect(ws.getCell('H1').value).toBe('Number of cassettes');
    expect(ws.getCell('L1').value).toBe('Compliance');
    expect(ws.getCell('L2').value).toContain('Storage');
    expect(ws.getCell('O2').value).toContain('Signatures');

    const merges: string[] = (ws as any).model.merges;
    expect(merges).toEqual(expect.arrayContaining(['D1:F1', 'L1:O1', 'A1:A2']));
    // multi-location case (rows 4-5) merges col A vertically
    expect(merges).toEqual(expect.arrayContaining(['A4:A5']));

    expect(ws.getCell('C3').numFmt.toLowerCase()).toContain('dd'); // OR date is a real date
    expect(ws.getCell('B3').value).toContain('\n');                // PID has M/F lines
    expect(ws.getCell('D3').value).toBe(9);                        // embryo count
    expect(ws.getCell('L3').dataValidation?.type).toBe('list');
    expect(ws.getCell('L3').dataValidation?.formulae).toEqual(['"N/A,Yes,No"']);
    expect(ws.getCell('O3').dataValidation?.type).toBe('list');    // Signatures dropdown too
    // Compliance is auditor-entered: empty values leave the cell blank.
    expect(ws.getCell('L3').value ?? '').toBe('');
    expect(ws.getCell('O3').value ?? '').toBe('');

    // sperm case on row 6: same table, cassette/tec N/A
    expect(ws.getCell('C6').value).toBe('N/A');   // no OR date
    expect(ws.getCell('F6').value).toBe(1);       // sperm count
    expect(ws.getCell('G6').value).toBe('TS4-G2D');
    expect(ws.getCell('H6').value).toBe('N/A');   // cassettes N/A
    expect(ws.getCell('K6').value).toBe('N/A');   // tec color N/A

    // Total row after 4 data rows (rows 3-6) → row 7
    expect(ws.getCell('C7').value).toBe('Total');
    const d7 = ws.getCell('D7').value as any;
    expect(d7.formula ?? d7).toContain('SUM(D3:D6)');
    const f7 = ws.getCell('F7').value as any;
    expect(f7.formula ?? f7).toContain('SUM(F3:F6)');
  });
});

// Regression: a parsed date must survive the XLSX write/load round-trip on the
// same calendar day. parseVnDate produces UTC midnight; ExcelJS converts Dates to
// serials with UTC math, so a non-UTC-midnight Date would shift the displayed day.
describe('date integrity across XLSX serialization', () => {
  const utcDay = (d: Date) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];

  it('keeps the OR date on the same calendar day through a write/load round-trip', async () => {
    const wb = await buildWorkbook([baseRow({
      no: 1, pid: 'M: 2410195189', orDate: parseVnDate('14/11/2025'), embryo: 1, location: 'E12G9T',
    })]);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(await wb.xlsx.writeBuffer());
    const ws = wb2.getWorksheet('Trang tính1')!;
    expect(utcDay(ws.getCell('C3').value as Date)).toEqual([2025, 11, 14]);
  });

  it('rejects non-UTC-midnight dates instead of silently shifting the displayed day', async () => {
    const wrongConvention = new Date(Date.UTC(2025, 10, 13, 17, 0)); // == local midnight 14/11 on UTC+7
    await expect(buildWorkbook([baseRow({ no: 1, orDate: wrongConvention })]))
      .rejects.toThrow(/UTC midnight/);
  });
});
