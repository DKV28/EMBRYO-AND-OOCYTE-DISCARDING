import type { TextItem, RawRecord, RawColumn } from './types';
import { parseVnDate } from './dates';
import { parseSampleTotals } from './samples';

const TABLE_LABELS = ['Vị trí cất', 'Stt cassette', 'Màu cassette', 'Stt tec', 'Màu tec', 'Mã sinh thiết'];

interface Line { y: number; items: TextItem[]; text: string; }

function buildLines(items: TextItem[]): Line[] {
  const sorted = [...items].filter(i => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  const Y_TOL = 4;
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= Y_TOL) last.push(it);
    else lines.push([it]);
  }
  return lines.map(l => {
    l.sort((a, b) => a.x - b.x);
    return { y: l[0].y, items: l, text: l.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim() };
  });
}

// Return value tokens after consuming the leading label tokens (by accumulated length).
function valueTokens(line: Line, label: string): TextItem[] {
  const toks = [...line.items].sort((a, b) => a.x - b.x);
  const targetLen = label.replace(/\s+/g, '').length;
  let acc = 0, i = 0;
  while (i < toks.length && acc < targetLen) { acc += toks[i].str.replace(/\s+/g, '').length; i++; }
  return toks.slice(i);
}

// Cluster x positions into column centers (first-seen within tolerance).
function columnCenters(allValueTokens: TextItem[]): number[] {
  const centers: number[] = [];
  const TOL = 25;
  for (const t of [...allValueTokens].sort((a, b) => a.x - b.x)) {
    if (!centers.some(c => Math.abs(c - t.x) <= TOL)) centers.push(t.x);
  }
  return centers.sort((a, b) => a - b);
}

// Assign tokens to nearest column center, join tokens sharing a column.
function rowCells(tokens: TextItem[], centers: number[]): string[] {
  const buckets: string[][] = centers.map(() => []);
  for (const t of tokens) {
    let bi = 0, bd = Infinity;
    centers.forEach((c, i) => { const d = Math.abs(c - t.x); if (d < bd) { bd = d; bi = i; } });
    buckets[bi].push(t.str);
  }
  return buckets.map(b => b.join(' ').replace(/\s+/g, ' ').trim());
}

export function parseRecordFromItems(items: TextItem[], fileName: string): RawRecord {
  const lines = buildLines(items);
  const fullText = lines.map(l => l.text).join('\n');

  const valueAfter = (label: string, occurrence = 0): string | null => {
    let seen = 0;
    for (const l of lines) {
      if (l.text.startsWith(label)) {
        if (seen === occurrence) return l.text.slice(label.length).trim();
        seen++;
      }
    }
    return null;
  };

  if (/TA2\.HSBA\.266/.test(fullText) || /Hủy tinh trùng trữ đông/.test(fullText)) {
    return parse266(lines, valueAfter, fileName);
  }
  if (!/Vị trí cất/.test(fullText) || !/Tổng số mẫu hủy/.test(fullText)) {
    throw new Error('Not a recognized destruction record (expected TA2.HSBA.267 embryo or TA2.HSBA.266 sperm form)');
  }
  const warnings: string[] = [];

  const wifeName = valueAfter('Họ tên vợ') ?? '';
  const husbandName = valueAfter('Họ tên chồng') ?? '';
  const wifePID = valueAfter('PID', 0) ?? '';
  const husbandPID = valueAfter('PID', 1) ?? '';
  const orDate = parseVnDate(valueAfter('Ngày chọc hút') ?? '');
  if (!orDate) warnings.push('Could not parse OR date (Ngày chọc hút)');
  const { samples, warnings: sw } = parseSampleTotals(valueAfter('Tổng số mẫu hủy') ?? '');
  warnings.push(...sw);

  // Table block
  const tableLines = TABLE_LABELS.map(lbl => ({ lbl, line: lines.find(l => l.text.startsWith(lbl)) ?? null }));
  // A cell value wider than its column wraps onto its own lines just above/below the
  // row label (the cell is vertically centred on the row while the label is one text
  // line) — attach each such orphan line to the nearest label. Row pitch is ~28 units
  // and wrapped lines sit ~7 from the label, so ROW_TOL = 10 separates them cleanly.
  const ROW_TOL = 10;
  const labelLineSet = new Set(tableLines.map(t => t.line).filter(Boolean));
  const wrappedByLabel = new Map<string, Line[]>();
  for (const l of lines) {
    if (labelLineSet.has(l)) continue;
    let best: { lbl: string; d: number } | null = null;
    for (const { lbl, line } of tableLines) {
      if (!line) continue;
      const d = Math.abs(l.y - line.y);
      if (d <= ROW_TOL && (!best || d < best.d)) best = { lbl, d };
    }
    if (best) wrappedByLabel.set(best.lbl, [...(wrappedByLabel.get(best.lbl) ?? []), l]);
  }
  const valTokensByLabel = new Map<string, TextItem[]>();
  const pool: TextItem[] = [];
  for (const { lbl, line } of tableLines) {
    const segs = line ? [{ y: line.y, toks: valueTokens(line, lbl) }] : [];
    for (const w of wrappedByLabel.get(lbl) ?? []) segs.push({ y: w.y, toks: w.items });
    segs.sort((a, b) => a.y - b.y);                 // top-to-bottom so "XANH" precedes "DƯƠNG"
    const v = segs.flatMap(s => s.toks);
    valTokensByLabel.set(lbl, v);
    if (lbl !== 'Mã sinh thiết') pool.push(...v);   // biopsy may be blank; don't rely on it for centers
  }
  const centers = columnCenters(pool);
  const cell = (lbl: string) => rowCells(valTokensByLabel.get(lbl) ?? [], centers);
  const loc = cell('Vị trí cất'), cassNo = cell('Stt cassette'), cassCol = cell('Màu cassette');
  const tecNo = cell('Stt tec'), tecCol = cell('Màu tec'), biopsy = cell('Mã sinh thiết');

  const columns: RawColumn[] = [];
  for (let i = 0; i < centers.length; i++) {
    if (!loc[i]) continue;                          // no location in this column → skip
    columns.push({
      location: loc[i],
      cassetteNo: parseInt(cassNo[i], 10) || 0,
      cassetteColorVi: cassCol[i] ?? '',
      tecNo: parseInt(tecNo[i], 10) || 0,
      tecColorVi: tecCol[i] ?? '',
      biopsy: biopsy[i] ?? '',
    });
  }
  if (columns.length === 0) warnings.push('No storage-location columns parsed');

  return { fileName, form: '267', wifeName, husbandName, wifePID, husbandPID, orDate, freezeDate: null, samples, columns, sperm266: null, warnings };
}

// TA2.HSBA.266: sperm destruction by patient request — simple key-value layout.
// Husband block comes first, so PID occurrence 0 = husband, 1 = wife/single woman.
function parse266(
  _lines: Line[],
  valueAfter: (label: string, occurrence?: number) => string | null,
  fileName: string,
): RawRecord {
  const warnings: string[] = [];

  const husbandName = valueAfter('Họ tên chồng') ?? '';
  // label reads "Họ tên vợ(hoặc phụ nữ độc thân)" — drop the parenthetical
  const wifeName = (valueAfter('Họ tên vợ') ?? '').replace(/^\(hoặc phụ nữ độc thân\)\s*/, '');
  const husbandPID = valueAfter('PID', 0) ?? '';
  const wifePID = valueAfter('PID', 1) ?? '';
  if (!husbandPID && !wifePID) warnings.push('No PID found');

  const freezeDate = parseVnDate(valueAfter('Ngày trữ tinh trùng') ?? '');
  if (!freezeDate) warnings.push('Could not parse freeze date (Ngày trữ tinh trùng)');

  const location = valueAfter('Vị trí cất') ?? '';
  if (!location) warnings.push('No storage location (Vị trí cất) found');
  const origin = valueAfter('Loại mẫu hủy') ?? '';
  const containerColorVi = valueAfter('Màu cassette/Tec') ?? '';
  if (!containerColorVi) warnings.push('No container color (Màu cassette/Tec) found');
  const count = parseInt(valueAfter('Số mẫu hủy') ?? '', 10);
  if (!Number.isFinite(count)) warnings.push('Could not parse sample count (Số mẫu hủy)');
  const note = valueAfter('Ghi chú') ?? '';

  return {
    fileName, form: '266', wifeName, husbandName, wifePID, husbandPID,
    orDate: null, freezeDate,
    samples: [{ type: 'Sperm', count: Number.isFinite(count) ? count : 0 }],
    columns: [],
    sperm266: { location, containerColorVi, count: Number.isFinite(count) ? count : 0, origin, note },
    warnings,
  };
}

// pdfjs is injected so the browser passes the web build and tests can pass the legacy build.
export async function extractPdfItems(data: Uint8Array, pdfjs: any): Promise<TextItem[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items as any[]) {
      if (typeof it.str !== 'string' || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: viewport.height - it.transform[5] });
    }
    return items;
  } finally {
    await doc.destroy();
  }
}
