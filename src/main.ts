import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPdfItems, parseRecordFromItems } from './pdfParser';
import { validateFile } from './fileValidation';
import { transform } from './transform';
import { renderPreview } from './preview';
import { workbookBlob } from './excelWriter';
import { reportBlob, DEFAULT_AUDITOR } from './reportWriter';
import { nearestWednesday, formatYmd } from './dates';
import { serializeSession, deserializeSession, type SessionState, type ComplianceValues } from './session';
import { saveLocal, loadLocal } from './localCache';
import { syncConfigured, saveSession, loadSession } from './supabaseSync';
import type { RawRecord, OutputRow } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Entry { fileName: string; file?: File; status: 'ok' | 'error'; record?: RawRecord; error?: string; }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dateInput = $<HTMLInputElement>('discardDate');
const fileInput = $<HTMLInputElement>('fileInput');
const dropzone = $<HTMLDivElement>('dropzone');
const fileList = $<HTMLUListElement>('fileList');
const messages = $<HTMLDivElement>('messages');
const preview = $<HTMLDivElement>('preview');
const downloadBtn = $<HTMLButtonElement>('downloadBtn');
const reportBtn = $<HTMLButtonElement>('reportBtn');
const auditorInput = $<HTMLInputElement>('auditor');
const syncCode = $<HTMLInputElement>('syncCode');
const saveCloudBtn = $<HTMLButtonElement>('saveCloudBtn');
const loadCloudBtn = $<HTMLButtonElement>('loadCloudBtn');
const syncStatus = $<HTMLSpanElement>('syncStatus');

dateInput.value = formatYmd(nearestWednesday(new Date()));
auditorInput.value = DEFAULT_AUDITOR;

const entries: Entry[] = [];
// Rows backing the current preview. Compliance dropdowns mutate these in place.
let displayedRows: OutputRow[] = [];
// Compliance the auditor entered, keyed by row so it survives a re-transform and a
// reload. The dropdowns mutate displayedRows; captureCompliance() folds those edits
// back into this map, applyCompliance() restores them onto freshly transformed rows.
const complianceByKey = new Map<string, ComplianceValues>();
const rowKey = (r: OutputRow) => `${r.pid ?? ''}|${r.location}`;

function captureCompliance() {
  for (const r of displayedRows) {
    const v: ComplianceValues = {
      storage: r.storageCompliance, cf: r.cfCompliance,
      discarding: r.discardingProcedure, signatures: r.signaturesCompliance,
    };
    if (v.storage || v.cf || v.discarding || v.signatures) complianceByKey.set(rowKey(r), v);
    else complianceByKey.delete(rowKey(r));
  }
}
function applyCompliance(rows: OutputRow[]) {
  for (const r of rows) {
    const v = complianceByKey.get(rowKey(r));
    if (v) {
      r.storageCompliance = v.storage; r.cfCompliance = v.cf;
      r.discardingProcedure = v.discarding; r.signaturesCompliance = v.signatures;
    }
  }
}

async function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    const check = validateFile(file, entries.map(e => e.fileName));
    if (!check.ok) {
      // Show why the file was rejected instead of dropping it silently.
      entries.push({ fileName: file.name, file, status: 'error', error: check.reason });
      continue;
    }
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const items = await extractPdfItems(data, pdfjs);
      const record = parseRecordFromItems(items, file.name);
      entries.push({ fileName: file.name, file, status: 'ok', record });
    } catch (err) {
      entries.push({ fileName: file.name, file, status: 'error', error: (err as Error).message });
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
  captureCompliance();            // keep edits before we rebuild the rows
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
      li.append(status, nameSpan(`${r.wifeName || r.husbandName || e.fileName} — ${locs} loc, ${samp}`));
    } else {
      status.className = 'err'; status.textContent = '✗';
      li.append(status, nameSpan(`${e.fileName} — ${e.error}`));
    }
    li.append(btn('↑', () => move(i, -1)), btn('↓', () => move(i, 1)), btn('✕', () => remove(i)));
    fileList.append(li);
  });

  const { rows, warnings } = currentRows();
  applyCompliance(rows);
  displayedRows = rows;
  messages.textContent = warnings.join('\n');
  preview.innerHTML = '';
  if (rows.length) preview.append(renderPreview(rows));
  downloadBtn.disabled = rows.length === 0;
  reportBtn.disabled = rows.length === 0;
  persistLocal();
}

function auditDate() { return dateInput.valueAsDate ?? new Date(dateInput.value); }

// --- Persistence ---
function buildState(): SessionState {
  return {
    discardingDate: dateInput.value || null,
    auditor: auditorInput.value,
    records: entries.filter(e => e.status === 'ok').map(e => e.record!),
    compliance: Object.fromEntries(complianceByKey),
  };
}
function persistLocal() {
  try { saveLocal(serializeSession(buildState())); } catch { /* ignore */ }
}
function restore(state: SessionState) {
  dateInput.value = state.discardingDate ?? dateInput.value;
  if (state.auditor) auditorInput.value = state.auditor;
  entries.length = 0;
  for (const rec of state.records) entries.push({ fileName: rec.fileName, status: 'ok', record: rec });
  complianceByKey.clear();
  for (const [k, v] of Object.entries(state.compliance)) complianceByKey.set(k, v);
  rerender();
}

// Autosave when the auditor changes a compliance dropdown (events bubble to #preview).
preview.addEventListener('change', () => { captureCompliance(); persistLocal(); });
auditorInput.addEventListener('change', persistLocal);

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

reportBtn.onclick = async () => {
  if (!displayedRows.length) return;
  const blob = await reportBlob(displayedRows, { auditor: auditorInput.value.trim() || DEFAULT_AUDITOR, auditDate: auditDate() });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Audit report - discarding ${dateInput.value}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// --- Cloud sync (optional) ---
function setSync(msg: string) { syncStatus.textContent = msg; }
if (!syncConfigured) {
  saveCloudBtn.disabled = true; loadCloudBtn.disabled = true;
  setSync('Cloud sync not configured (set Supabase env vars).');
}
saveCloudBtn.onclick = async () => {
  const code = syncCode.value.trim();
  if (!code) return setSync('Enter a sync code first.');
  setSync('Saving…');
  try {
    captureCompliance();
    await saveSession(code, serializeSession(buildState()));
    setSync(`Saved to cloud ✓ (${new Date().toLocaleTimeString()})`);
  } catch (err) { setSync(`Save failed: ${(err as Error).message}`); }
};
loadCloudBtn.onclick = async () => {
  const code = syncCode.value.trim();
  if (!code) return setSync('Enter a sync code first.');
  setSync('Loading…');
  try {
    const json = await loadSession(code);
    if (!json) return setSync('No saved session for that code.');
    restore(deserializeSession(json));
    setSync(`Loaded ✓ (${new Date().toLocaleTimeString()})`);
  } catch (err) { setSync(`Load failed (wrong code?): ${(err as Error).message}`); }
};

// --- Restore any local autosave on startup ---
(() => {
  const json = loadLocal();
  if (!json) return;
  try { restore(deserializeSession(json)); } catch { /* corrupt cache → ignore */ }
})();
