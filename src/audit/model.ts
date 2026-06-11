import type { RawRecord, OutputRow } from '../types';
import type { ComplianceValues } from '../session';
import { transform } from '../transform';
import { formatDmy } from '../dates';

// Audit data model — ported from the reference audit form (Google-Sheets parts
// dropped). "Expected" comes from the prepared PDF case; the auditor fills in the
// actual / checks / verdicts on audit day.

export type CheckValue = '' | 'Đúng' | 'Sai';
export type Verdict = '' | 'Đạt' | 'Không đạt';
export type ItemStatus = 'Có' | 'Không thấy' | 'Phát sinh';
export type ItemType = 'Expected' | 'Phát sinh';
export type YesNo = '' | 'YES' | 'NO';

export const ITEM_FIELDS = ['location', 'numCassettes', 'colorCassettes', 'numTec', 'colorTec'] as const;
export type ItemField = typeof ITEM_FIELDS[number];
export const FIELD_LABELS: Record<ItemField, string> = {
  location: 'Location', numCassettes: 'No. Cassettes', colorCassettes: 'Color Cassettes',
  numTec: 'No. Tec', colorTec: 'Color Tec',
};

export interface AuditField { expected: string; actual: string; check: CheckValue; note: string; }
export interface AuditItem {
  itemNo: number;
  itemType: ItemType;
  itemStatus: ItemStatus;
  verdict: Verdict;
  fields: Record<ItemField, AuditField>;
}
export interface AuditRecord {
  caseKey: string;
  pid: string;
  orDate: string;          // dd/mm/yyyy or 'N/A'
  auditor: string;
  saveCount: number;
  timestamp: string;
  expectedSample: string;
  sampleCheck: CheckValue;
  actualSample: string;
  sampleNote: string;
  signatures: YesNo;
  cfCompliance: YesNo;
  storageCompliance: YesNo;
  discardingProc: YesNo;
  complianceNotes: string;
  finalResult: Verdict;
  items: AuditItem[];
}

// One pickable case = one prepared PDF.
export interface AuditCase {
  key: string;
  label: string;
  pid: string;
  orDate: string;
  expectedSample: string;
  expectedItems: AuditItem[];
}

export function pidLabel(rec: RawRecord): string {
  const p: string[] = [];
  if (rec.husbandPID) p.push(`M: ${rec.husbandPID}`);
  if (rec.wifePID) p.push(`F: ${rec.wifePID}`);
  return p.join('\n');
}

export function sampleText(rec: RawRecord): string {
  return rec.samples.map(s => `${s.type}: ${s.count}`).join('; ');
}

const blankField = (expected = ''): AuditField => ({ expected, actual: '', check: '', note: '' });

function expectedItemFromRow(row: OutputRow, itemNo: number): AuditItem {
  const str = (v: number | 'N/A') => String(v);
  return {
    itemNo,
    itemType: 'Expected',
    itemStatus: 'Có',
    verdict: '',
    fields: {
      location: blankField(row.location),
      numCassettes: blankField(str(row.numCassettes)),
      colorCassettes: blankField(row.cassetteColor),
      numTec: blankField(str(row.numTec)),
      colorTec: blankField(row.tecColor),
    },
  };
}

export function emptyItem(itemNo: number): AuditItem {
  return {
    itemNo, itemType: 'Phát sinh', itemStatus: 'Phát sinh', verdict: 'Không đạt',
    fields: {
      location: blankField(), numCassettes: blankField(), colorCassettes: blankField(),
      numTec: blankField(), colorTec: blankField(),
    },
  };
}

// Build the pickable case (expected values) from a prepared record.
export function buildCase(rec: RawRecord, date: Date): AuditCase {
  const { rows } = transform([rec], date);
  const expectedItems = rows.map((r, i) => expectedItemFromRow(r, i + 1));
  const orDate = rec.orDate ? formatDmy(rec.orDate) : rec.freezeDate ? formatDmy(rec.freezeDate) : 'N/A';
  const name = rec.wifeName || rec.husbandName || rec.fileName;
  const pid = pidLabel(rec);
  return {
    key: rec.fileName,
    label: `${name} · ${pid.replace(/\n/g, ' / ') || '—'} · ${orDate}`,
    pid,
    orDate,
    expectedSample: sampleText(rec),
    expectedItems,
  };
}

// A fresh audit for a case (no prior save), prefilled with expected values.
export function blankAudit(c: AuditCase, auditor: string): AuditRecord {
  return {
    caseKey: c.key, pid: c.pid, orDate: c.orDate, auditor,
    saveCount: 0, timestamp: '',
    expectedSample: c.expectedSample, sampleCheck: '', actualSample: '', sampleNote: '',
    signatures: '', cfCompliance: '', storageCompliance: '', discardingProc: '',
    complianceNotes: '', finalResult: '',
    items: c.expectedItems.map(it => ({ ...it, fields: cloneFields(it.fields) })),
  };
}

function cloneFields(f: Record<ItemField, AuditField>): Record<ItemField, AuditField> {
  const out = {} as Record<ItemField, AuditField>;
  for (const k of ITEM_FIELDS) out[k] = { ...f[k] };
  return out;
}

// Map the 4 case-level compliance toggles to the per-row compliance overlay.
export function complianceToOverlay(rec: AuditRecord): ComplianceValues {
  const m = (v: YesNo) => (v === 'YES' ? 'Yes' : v === 'NO' ? 'No' : '');
  return {
    storage: m(rec.storageCompliance), cf: m(rec.cfCompliance),
    discarding: m(rec.discardingProc), signatures: m(rec.signatures),
  };
}

// Validation ported from the reference (validateClient_/validateItem_).
export function validateAudit(rec: AuditRecord): string {
  if (!rec.auditor.trim()) return 'Vui lòng nhập Auditor';
  if (!rec.sampleCheck) return 'Vui lòng tick Đúng/Sai cho Sample';
  if (rec.sampleCheck === 'Sai' && !rec.actualSample.trim()) return 'Vui lòng nhập Actual Sample';
  if (!rec.signatures || !rec.cfCompliance || !rec.storageCompliance || !rec.discardingProc) {
    return 'Vui lòng hoàn tất Compliance';
  }
  if (!rec.finalResult) return 'Vui lòng chọn kết luận Đạt / Không đạt';

  for (let i = 0; i < rec.items.length; i++) {
    const it = rec.items[i];
    const label = `Item ${i + 1}`;
    if (it.itemType === 'Phát sinh') {
      if (!it.fields.location.actual.trim()) return `${label}: vui lòng nhập Actual Location`;
      const pairErr = validatePairs(it, label);
      if (pairErr) return pairErr;
      continue;
    }
    if (it.itemStatus === 'Không thấy') continue;
    if (!it.verdict) return `${label}: vui lòng chọn Đạt / Không đạt`;
    if (it.verdict === 'Không đạt') {
      for (const f of ITEM_FIELDS) {
        const fld = it.fields[f];
        if (fld.expected && !fld.actual.trim()) return `${label}: vui lòng nhập giá trị đúng cho ${FIELD_LABELS[f]}`;
      }
    }
  }
  return '';
}

function validatePairs(it: AuditItem, label: string): string {
  const f = it.fields;
  if (f.numCassettes.actual && !f.colorCassettes.actual) return `${label}: vui lòng nhập Color Cassettes`;
  if (f.colorCassettes.actual && !f.numCassettes.actual) return `${label}: vui lòng nhập No. Cassettes`;
  if (f.numTec.actual && !f.colorTec.actual) return `${label}: vui lòng nhập Color Tec`;
  if (f.colorTec.actual && !f.numTec.actual) return `${label}: vui lòng nhập No. Tec`;
  return '';
}

// Finalize per-field check/actual based on verdict before saving (ported logic).
export function normalizeItem(it: AuditItem): AuditItem {
  for (const f of ITEM_FIELDS) {
    const fld = it.fields[f];
    if (it.itemType === 'Phát sinh') {
      fld.check = 'Sai';
    } else if (it.verdict === 'Đạt') {
      fld.actual = fld.expected;
      fld.check = fld.expected ? 'Đúng' : '';
    } else {
      if (!fld.expected && !fld.actual) fld.check = '';
      else fld.check = fld.actual === fld.expected ? 'Đúng' : 'Sai';
    }
  }
  return it;
}
