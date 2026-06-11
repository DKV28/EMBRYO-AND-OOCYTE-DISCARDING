import ExcelJS from 'exceljs';
import type { OutputRow } from './types';

const CREAM = 'FFFFF2CC';
const PINK = 'FFEAD1DC';

function styleHeader(cell: ExcelJS.Cell, text: string, fill: string) {
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, bold: true };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

// Columns: A No | B Discarding date | C PID | D OR Date | E Freeze date |
// F-H Sample (Embryo/Oocyte/Sperm) | I Location | J-M cassette/tec | N-P containers |
// Q Loại mẫu hủy | R Ghi chú | S-U Compliance.
const LAST_COL = 21; // U
const CASE_COLS = 8; // A-H merge vertically for multi-location cases

export async function buildWorkbook(rows: OutputRow[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Trang tính1');

  // --- Header (rows 1-2) ---
  ws.mergeCells('A1:A2'); styleHeader(ws.getCell('A1'), 'No.', CREAM);
  ws.mergeCells('B1:B2'); styleHeader(ws.getCell('B1'), 'Discarding date', CREAM);
  ws.mergeCells('C1:C2'); styleHeader(ws.getCell('C1'), 'PID', CREAM);
  ws.mergeCells('D1:D2'); styleHeader(ws.getCell('D1'), 'OR Date', CREAM);
  ws.mergeCells('E1:E2'); styleHeader(ws.getCell('E1'), 'Freeze date', CREAM);
  ws.mergeCells('F1:H1'); styleHeader(ws.getCell('F1'), 'Sample', PINK);
  styleHeader(ws.getCell('F2'), 'Embryo', PINK);
  styleHeader(ws.getCell('G2'), 'Oocyte', PINK);
  styleHeader(ws.getCell('H2'), 'Sperm', PINK);
  ws.mergeCells('I1:I2'); styleHeader(ws.getCell('I1'), 'Location', CREAM);
  ws.mergeCells('J1:J2'); styleHeader(ws.getCell('J1'), 'Number of cassettes', CREAM);
  ws.mergeCells('K1:K2'); styleHeader(ws.getCell('K1'), 'Color of cassettes', CREAM);
  ws.mergeCells('L1:L2'); styleHeader(ws.getCell('L1'), 'Number of tec', CREAM);
  ws.mergeCells('M1:M2'); styleHeader(ws.getCell('M1'), 'Color of tec', CREAM);
  ws.mergeCells('N1:N2'); styleHeader(ws.getCell('N1'), 'Number of containers', CREAM);
  ws.mergeCells('O1:O2'); styleHeader(ws.getCell('O1'), 'Container type', CREAM);
  ws.mergeCells('P1:P2'); styleHeader(ws.getCell('P1'), 'Container color', CREAM);
  ws.mergeCells('Q1:Q2'); styleHeader(ws.getCell('Q1'), 'Sample origin\n(Loại mẫu hủy)', CREAM);
  ws.mergeCells('R1:R2'); styleHeader(ws.getCell('R1'), 'Notes\n(Ghi chú)', CREAM);
  ws.mergeCells('S1:U1'); styleHeader(ws.getCell('S1'), 'Compliance', PINK);
  styleHeader(ws.getCell('S2'), 'Storage\nCompliance', PINK);
  styleHeader(ws.getCell('T2'), 'CF\nCompliance', PINK);
  styleHeader(ws.getCell('U2'), 'Discarding\nProcedure', PINK);

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
      setDate(2, r.discardingDate);
      set(3, r.pid);
      setDate(4, r.orDate);
      setDate(5, r.freezeDate);
      set(6, r.embryo); set(7, r.oocyte); set(8, r.sperm);
    }
    set(9, r.location);
    set(10, r.numCassettes); set(11, r.cassetteColor);
    set(12, r.numTec); set(13, r.tecColor);
    set(14, r.numContainers); set(15, r.containerType); set(16, r.containerColor);
    set(17, r.origin); set(18, r.note);
    // Compliance: only write a value when the auditor chose one; otherwise leave blank.
    if (r.storageCompliance) set(19, r.storageCompliance);
    if (r.cfCompliance) set(20, r.cfCompliance);
    if (r.discardingProcedure) set(21, r.discardingProcedure);

    // styling: Calibri 11, wrap, vcenter; PID left, others centered
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: c === 3 ? 'left' : 'center', wrapText: true };
    }
    // Compliance dropdowns on S,T,U
    for (let c = 19; c <= 21; c++) {
      row.getCell(c).dataValidation = { type: 'list', allowBlank: true, formulae: ['"N/A,Yes,No"'] };
    }
  });

  // --- Vertical merges for multi-location cases (cols A–H) ---
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
  totalRow.getCell(5).value = 'Total';
  totalRow.getCell(5).font = { name: 'Calibri', size: 11, bold: true };
  totalRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
  const sumCols: { col: number; key: keyof OutputRow }[] = [
    { col: 6, key: 'embryo' }, { col: 7, key: 'oocyte' }, { col: 8, key: 'sperm' },
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

  // --- Column widths ---
  const widths: Record<number, number> = {
    1: 5, 2: 12, 3: 18, 4: 12, 5: 12, 6: 8, 7: 8, 8: 8, 9: 12, 10: 11, 11: 13,
    12: 10, 13: 12, 14: 12, 15: 11, 16: 11, 17: 13, 18: 20, 19: 14.9, 20: 12, 21: 13,
  };
  for (const [c, w] of Object.entries(widths)) ws.getColumn(+c).width = w;

  return wb;
}

export async function workbookBlob(rows: OutputRow[]): Promise<Blob> {
  const wb = await buildWorkbook(rows);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
