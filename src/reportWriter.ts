import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, PageOrientation,
} from 'docx';
import type { OutputRow } from './types';
import { formatDmy } from './dates';
import { bankCodeFromNote } from './bankCode';

// Reproduces the "AUDIT REPORT — CONSENT FORMS FOR EMBRYO AND SPERM DISCARDING"
// Word template: title block + metadata + the same 15-column table as the Excel
// (with the added Signatures Compliance column).

export interface ReportMeta {
  auditor: string;       // e.g. "Nguyen Tuong Vy – Quality Management Department"
  auditDate: Date;       // UTC midnight
}

export const DEFAULT_AUDITOR = 'Nguyen Tuong Vy – Quality Management Department';
const METHOD = 'review medical records and observe the discarding procedure';

const CREAM = 'FFF2CC';
const PINK = 'EAD1DC';

// Count cases by type for the "N = X embryo cases and Y sperm cases" line.
export function countCases(rows: OutputRow[]): { nEmbryo: number; nSperm: number } {
  let nEmbryo = 0, nSperm = 0;
  for (const r of rows) {
    if (!r.isCaseStart) continue;
    if (r.embryo != null || r.oocyte != null) nEmbryo++;
    else if (r.sperm != null) nSperm++;
    else nEmbryo++;
  }
  return { nEmbryo, nSperm };
}

const num = (n: number | 'N/A' | null) => (n == null ? '' : String(n));
const date = (d: Date | 'N/A' | null) => (d == null ? '' : d instanceof Date ? formatDmy(d) : d);
const fmtAuditDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);

function cell(text: string, opts: { bold?: boolean; fill?: string; rowSpan?: number; columnSpan?: number } = {}): TableCell {
  // PID carries a literal newline between the M: and F: lines.
  const lines = text.split('\n');
  const children = lines.map((line, i) =>
    new TextRun({ text: line, bold: opts.bold, break: i > 0 ? 1 : undefined }));
  return new TableCell({
    rowSpan: opts.rowSpan,
    columnSpan: opts.columnSpan,
    shading: opts.fill ? { fill: opts.fill } : undefined,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children })],
  });
}

function headerRows(): TableRow[] {
  const r1 = new TableRow({
    tableHeader: true,
    children: [
      cell('No.', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('PID', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('OR Date', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('Sample', { bold: true, fill: PINK, columnSpan: 3 }),
      cell('Location', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('Number of cassettes', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('Color of cassettes', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('Number of tec', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('Color of tec', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('Sperm bank code', { bold: true, fill: CREAM, rowSpan: 2 }),
      cell('Compliance', { bold: true, fill: PINK, columnSpan: 4 }),
    ],
  });
  const r2 = new TableRow({
    tableHeader: true,
    children: [
      cell('Embryo', { bold: true, fill: PINK }),
      cell('Oocyte', { bold: true, fill: PINK }),
      cell('Sperm', { bold: true, fill: PINK }),
      cell('Storage\nCompliance', { bold: true, fill: PINK }),
      cell('CF\nCompliance', { bold: true, fill: PINK }),
      cell('Discarding\nProcedure', { bold: true, fill: PINK }),
      cell('Signatures\nCompliance', { bold: true, fill: PINK }),
    ],
  });
  return [r1, r2];
}

function dataRow(r: OutputRow): TableRow {
  const children: TableCell[] = [];
  if (r.isCaseStart) {
    const rs = r.caseRowSpan > 1 ? r.caseRowSpan : undefined;
    children.push(
      cell(num(r.no), { rowSpan: rs }),
      cell(r.pid ?? '', { rowSpan: rs }),
      cell(date(r.orDate), { rowSpan: rs }),
      cell(num(r.embryo), { rowSpan: rs }),
      cell(num(r.oocyte), { rowSpan: rs }),
      cell(num(r.sperm), { rowSpan: rs }),
    );
  }
  children.push(
    cell(r.location), cell(num(r.numCassettes)), cell(r.cassetteColor),
    cell(num(r.numTec)), cell(r.tecColor),
    cell(bankCodeFromNote(r.note)),
    cell(r.storageCompliance), cell(r.cfCompliance),
    cell(r.discardingProcedure), cell(r.signaturesCompliance),
  );
  return new TableRow({ children });
}

export function buildReportDoc(rows: OutputRow[], meta: ReportMeta): Document {
  const { nEmbryo, nSperm } = countCases(rows);
  const meta_p = (label: string, value: string) =>
    new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [...headerRows(), ...rows.map(dataRow)],
  });

  return new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: 'AUDIT REPORT CONSENT FORMS', bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: 'FOR EMBRYO AND SPERM DISCARDING', bold: true })] }),
        new Paragraph({ children: [] }),
        meta_p('Auditor', meta.auditor),
        meta_p('Audit date', fmtAuditDate(meta.auditDate)),
        meta_p('Method', METHOD),
        new Paragraph({ children: [
          new TextRun({ text: 'N = ', bold: true }),
          new TextRun(`${nEmbryo} embryo cases and ${nSperm} sperm cases`),
        ] }),
        new Paragraph({ children: [] }),
        table,
      ],
    }],
  });
}

export async function reportBlob(rows: OutputRow[], meta: ReportMeta): Promise<Blob> {
  return Packer.toBlob(buildReportDoc(rows, meta));
}
