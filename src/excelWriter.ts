import ExcelJS from 'exceljs';
import type { OutputRow } from './types';
import { bankCodeFromNote } from './bankCode';

const CREAM = 'FFFFF2CC';
const PINK = 'FFEAD1DC';

function styleHeader(cell: ExcelJS.Cell, text: string, fill: string) {
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, bold: true };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

// Based on the "Monitoring_Discarding audit" template (16 cols):
// A No | B PID | C OR Date | D-F Sample (Embryo/Oocyte/Sperm) | G Location |
// H Number of cassettes | I Color of cassettes | J Number of tec | K Color of tec |
// L Sperm bank code | M-P Compliance (Storage / CF / Discarding Procedure / Signatures).
const LAST_COL = 16; // P
const CASE_COLS = 6; // A-F merge vertically for multi-location cases
const FIRST_COMPLIANCE = 13; // M

export async function buildWorkbook(rows: OutputRow[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Trang tính1');

  // --- Header (rows 1-2) ---
  ws.mergeCells('A1:A2'); styleHeader(ws.getCell('A1'), 'No.', CREAM);
  ws.mergeCells('B1:B2'); styleHeader(ws.getCell('B1'), 'PID', CREAM);
  ws.mergeCells('C1:C2'); styleHeader(ws.getCell('C1'), 'OR Date', CREAM);
  ws.mergeCells('D1:F1'); styleHeader(ws.getCell('D1'), 'Sample', PINK);
  styleHeader(ws.getCell('D2'), 'Embryo', PINK);
  styleHeader(ws.getCell('E2'), 'Oocyte', PINK);
  styleHeader(ws.getCell('F2'), 'Sperm', PINK);
  ws.mergeCells('G1:G2'); styleHeader(ws.getCell('G1'), 'Location', CREAM);
  ws.mergeCells('H1:H2'); styleHeader(ws.getCell('H1'), 'Number of cassettes', CREAM);
  ws.mergeCells('I1:I2'); styleHeader(ws.getCell('I1'), 'Color of cassettes', CREAM);
  ws.mergeCells('J1:J2'); styleHeader(ws.getCell('J1'), 'Number of tec', CREAM);
  ws.mergeCells('K1:K2'); styleHeader(ws.getCell('K1'), 'Color of tec', CREAM);
  ws.mergeCells('L1:L2'); styleHeader(ws.getCell('L1'), 'Sperm bank code', CREAM);
  ws.mergeCells('M1:P1'); styleHeader(ws.getCell('M1'), 'Compliance', PINK);
  styleHeader(ws.getCell('M2'), 'Storage\nCompliance', PINK);
  styleHeader(ws.getCell('N2'), 'CF\nCompliance', PINK);
  styleHeader(ws.getCell('O2'), 'Discarding\nProcedure', PINK);
  styleHeader(ws.getCell('P2'), 'Signatures\nCompliance', PINK);

  // --- Data (from row 3) ---
  const FIRST = 3;
  rows.forEach((r, i) => {
    const rn = FIRST + i;
    const row = ws.getRow(rn);
    const set = (col: number, value: ExcelJS.CellValue) => { row.getCell(col).value = value; };
    const setDate = (col: number, value: Date | 'N/A' | null) => {
      if (value instanceof Date) {
        // ExcelJS turns Dates into serials with UTC math; anything but UTC
        // midnight displays as the wrong day in some timezone. Refuse loudly —
        // a silently shifted date corrupts the audit record (see dates.ts).
        if (value.getTime() % 86400000 !== 0) {
          throw new Error(`Date for column ${col} is not UTC midnight: ${value.toISOString()}`);
        }
        row.getCell(col).value = value; row.getCell(col).numFmt = 'dd/mm/yyyy';
      } else if (value) row.getCell(col).value = value;
    };
    if (r.isCaseStart) {
      set(1, r.no);
      set(2, r.pid);
      setDate(3, r.orDate);
      set(4, r.embryo); set(5, r.oocyte); set(6, r.sperm);
    }
    set(7, r.location);
    set(8, r.numCassettes); set(9, r.cassetteColor);
    set(10, r.numTec); set(11, r.tecColor);
    set(12, bankCodeFromNote(r.note));
    // Compliance: only write a value when the auditor chose one; otherwise leave blank.
    if (r.storageCompliance) set(13, r.storageCompliance);
    if (r.cfCompliance) set(14, r.cfCompliance);
    if (r.discardingProcedure) set(15, r.discardingProcedure);
    if (r.signaturesCompliance) set(16, r.signaturesCompliance);

    // styling: Calibri 11, wrap, vcenter; PID left, others centered
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center', wrapText: true };
    }
    // Compliance dropdowns on L–O
    for (let c = FIRST_COMPLIANCE; c <= LAST_COL; c++) {
      row.getCell(c).dataValidation = { type: 'list', allowBlank: true, formulae: ['"N/A,Yes,No"'] };
    }
  });

  // --- Vertical merges for multi-location cases (cols A–F) ---
  rows.forEach((r, i) => {
    if (r.isCaseStart && r.caseRowSpan > 1) {
      const top = FIRST + i, bottom = top + r.caseRowSpan - 1;
      for (let c = 1; c <= CASE_COLS; c++) ws.mergeCells(top, c, bottom, c);
    }
  });

  // --- Total row ---
  const last = FIRST + rows.length - 1;
  const totalRn = last + 1;
  const totalRow = ws.getRow(totalRn);
  totalRow.getCell(3).value = 'Total';
  totalRow.getCell(3).font = { name: 'Calibri', size: 11, bold: true };
  totalRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
  const sumCols: { col: number; key: keyof OutputRow }[] = [
    { col: 4, key: 'embryo' }, { col: 5, key: 'oocyte' }, { col: 6, key: 'sperm' },
  ];
  for (const { col, key } of sumCols) {
    if (rows.some(r => r[key] != null)) {
      const L = ws.getColumn(col).letter;
      const cell = totalRow.getCell(col);
      cell.value = { formula: `SUM(${L}${FIRST}:${L}${last})` } as ExcelJS.CellFormulaValue;
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // --- Column widths (match template) ---
  const widths: Record<number, number> = {
    1: 5, 2: 18, 3: 12, 4: 8, 5: 8, 6: 8, 7: 11, 8: 11, 9: 13, 10: 10, 11: 12,
    12: 14, 13: 15, 14: 12, 15: 13, 16: 13,
  };
  for (const [c, w] of Object.entries(widths)) ws.getColumn(+c).width = w;

  return wb;
}

export async function workbookBlob(rows: OutputRow[]): Promise<Blob> {
  const wb = await buildWorkbook(rows);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
