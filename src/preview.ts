import type { OutputRow } from './types';
import { formatDmy } from './dates';

function th(text: string, cls = '', attrs: Record<string, string> = {}): HTMLTableCellElement {
  const el = document.createElement('th');
  el.textContent = text; if (cls) el.className = cls;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function td(text: string, attrs: Record<string, string> = {}): HTMLTableCellElement {
  const el = document.createElement('td');
  el.innerHTML = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Compliance columns the auditor fills in: empty by default, then N/A / Yes / No.
const COMPLIANCE_OPTIONS = ['', 'N/A', 'Yes', 'No'];
function complianceCell(value: string, onChange: (v: string) => void): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = 'compliance';
  const sel = document.createElement('select');
  for (const opt of COMPLIANCE_OPTIONS) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt; // empty option renders blank → "default empty"
    if (opt === value) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  cell.append(sel);
  return cell;
}

export function renderPreview(rows: OutputRow[]): HTMLTableElement {
  const table = document.createElement('table');
  const thead = table.createTHead();
  const r1 = thead.insertRow();
  r1.append(
    th('No.', '', { rowspan: '2' }), th('PID', '', { rowspan: '2' }),
    th('OR Date', '', { rowspan: '2' }),
    th('Sample', 'group-sample', { colspan: '3' }),
    th('Location', '', { rowspan: '2' }), th('Number of cassettes', '', { rowspan: '2' }),
    th('Color of cassettes', '', { rowspan: '2' }), th('Number of tec', '', { rowspan: '2' }),
    th('Color of tec', '', { rowspan: '2' }),
    th('Compliance', 'group-compliance', { colspan: '4' }),
  );
  const r2 = thead.insertRow();
  r2.append(
    th('Embryo', 'group-sample'), th('Oocyte', 'group-sample'), th('Sperm', 'group-sample'),
    th('Storage', 'group-compliance'), th('CF', 'group-compliance'),
    th('Discarding', 'group-compliance'), th('Signatures', 'group-compliance'),
  );

  const tbody = table.createTBody();
  const num = (n: number | 'N/A' | null) => (n == null ? '' : String(n));
  const date = (d: Date | 'N/A' | null) => (d == null ? '' : d instanceof Date ? formatDmy(d) : d);
  for (const r of rows) {
    const tr = tbody.insertRow();
    if (r.isCaseStart) {
      const span: Record<string, string> = r.caseRowSpan > 1 ? { rowspan: String(r.caseRowSpan) } : {};
      tr.append(
        td(num(r.no), span),
        td((r.pid ?? '').replace(/\n/g, '<br>'), span), td(date(r.orDate), span),
        td(num(r.embryo), span), td(num(r.oocyte), span), td(num(r.sperm), span),
      );
    }
    tr.append(
      td(r.location), td(num(r.numCassettes)), td(r.cassetteColor),
      td(num(r.numTec)), td(r.tecColor),
      complianceCell(r.storageCompliance, v => { r.storageCompliance = v; }),
      complianceCell(r.cfCompliance, v => { r.cfCompliance = v; }),
      complianceCell(r.discardingProcedure, v => { r.discardingProcedure = v; }),
      complianceCell(r.signaturesCompliance, v => { r.signaturesCompliance = v; }),
    );
  }
  return table;
}
