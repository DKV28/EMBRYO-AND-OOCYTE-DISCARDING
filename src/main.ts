import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPdfItems, parseRecordFromItems } from './pdfParser';
import { validateFile } from './fileValidation';
import { transform } from './transform';
import { renderPreview } from './preview';
import { workbookBlob } from './excelWriter';
import { nearestWednesday, formatYmd } from './dates';
import type { RawRecord, OutputRow } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Entry { file: File; status: 'ok' | 'error'; record?: RawRecord; error?: string; }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dateInput = $<HTMLInputElement>('discardDate');
const fileInput = $<HTMLInputElement>('fileInput');
const dropzone = $<HTMLDivElement>('dropzone');
const fileList = $<HTMLUListElement>('fileList');
const messages = $<HTMLDivElement>('messages');
const preview = $<HTMLDivElement>('preview');
const downloadBtn = $<HTMLButtonElement>('downloadBtn');

dateInput.value = formatYmd(nearestWednesday(new Date()));

const entries: Entry[] = [];
// Rows backing the current preview. The compliance dropdowns mutate these objects
// in place, so the download must use this same array (not a fresh transform).
let displayedRows: OutputRow[] = [];

async function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    const check = validateFile(file, entries.map(e => e.file.name));
    if (!check.ok) {
      // Show why the file was rejected instead of dropping it silently.
      entries.push({ file, status: 'error', error: check.reason });
      continue;
    }
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const items = await extractPdfItems(data, pdfjs);
      const record = parseRecordFromItems(items, file.name);
      entries.push({ file, status: 'ok', record });
    } catch (err) {
      entries.push({ file, status: 'error', error: (err as Error).message });
    }
  }
  rerender();
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= entries.length) return;
  [entries[i], entries[j]] = [entries[j], entries[i]];
  rerender();
}
function remove(i: number) { entries.splice(i, 1); rerender(); }

function currentRows() {
  const recs = entries.filter(e => e.status === 'ok').map(e => e.record!);
  // Both branches yield UTC midnight (valueAsDate by spec; date-only strings
  // parse as UTC), matching the app-wide calendar-date convention in dates.ts.
  const date = dateInput.valueAsDate ?? new Date(dateInput.value);
  return transform(recs, date);
}

function nameSpan(text: string) { const s = document.createElement('span'); s.className = 'name'; s.textContent = text; return s; }
function btn(label: string, onClick: () => void) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = onClick; return b; }

function rerender() {
  fileList.innerHTML = '';
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    const status = document.createElement('span');
    if (e.status === 'ok') {
      const r = e.record!;
      const locs = r.sperm266 ? 1 : new Set(r.columns.map(c => c.location)).size;
      const samp = r.samples.map(s => `${s.count} ${s.type}`).join(', ') || '—';
      status.className = r.warnings.length ? 'warn' : 'ok';
      status.textContent = r.warnings.length ? '⚠' : '✓';
      li.title = r.warnings.join('\n');
      li.append(status, nameSpan(`${r.wifeName || r.husbandName || e.file.name} — ${locs} loc, ${samp}`));
    } else {
      status.className = 'err'; status.textContent = '✗';
      li.append(status, nameSpan(`${e.file.name} — ${e.error}`));
    }
    li.append(btn('↑', () => move(i, -1)), btn('↓', () => move(i, 1)), btn('✕', () => remove(i)));
    fileList.append(li);
  });

  const { rows, warnings } = currentRows();
  displayedRows = rows;
  messages.textContent = warnings.join('\n');
  preview.innerHTML = '';
  if (rows.length) preview.append(renderPreview(rows));
  downloadBtn.disabled = rows.length === 0;
}

$('pickBtn').onclick = () => fileInput.click();
fileInput.onchange = () => { if (fileInput.files) addFiles(fileInput.files); fileInput.value = ''; };
dateInput.onchange = rerender;
['dragover', 'dragenter'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => { if ((e as DragEvent).dataTransfer?.files) addFiles((e as DragEvent).dataTransfer!.files); });

downloadBtn.onclick = async () => {
  if (!displayedRows.length) return;
  const blob = await workbookBlob(displayedRows);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Monitoring_Discarding audit ${dateInput.value}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
};
