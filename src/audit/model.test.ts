// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildCase, blankAudit, validateAudit, complianceToOverlay, normalizeItem, type AuditRecord } from './model';
import type { RawRecord } from '../types';

const anh: RawRecord = {
  fileName: 'ANH.pdf', form: '267', wifeName: 'W', husbandName: 'H',
  wifePID: '2410001993', husbandPID: '2410001994', orDate: new Date(Date.UTC(2025, 5, 9)),
  samples: [{ type: 'Embryo', count: 2 }],
  columns: [
    { location: 'E23G6T', cassetteNo: 1, cassetteColorVi: 'XANH LÁ', tecNo: 1, tecColorVi: 'VÀNG', biopsy: '' },
    { location: 'E25G1G', cassetteNo: 2, cassetteColorVi: 'CAM', tecNo: 2, tecColorVi: 'XANH LÁ', biopsy: '' },
  ],
  warnings: [],
};
const sperm: RawRecord = {
  fileName: 'AN.pdf', form: '266', wifeName: '', husbandName: 'H',
  wifePID: '', husbandPID: '2410022517', orDate: null, freezeDate: new Date(Date.UTC(2025, 2, 17)),
  samples: [{ type: 'Sperm', count: 1 }], columns: [],
  sperm266: { location: 'TS4-G2D', containerColorVi: 'VÀNG', count: 1, origin: 'PESA', note: 'MÃ NHTT: 2414418' },
  warnings: [],
};
const DATE = new Date(Date.UTC(2026, 5, 10));

describe('buildCase', () => {
  it('derives expected sample and one item per location', () => {
    const c = buildCase(anh, DATE);
    expect(c.key).toBe('ANH.pdf');
    expect(c.orDate).toBe('09/06/2025');
    expect(c.expectedSample).toBe('Embryo: 2');
    expect(c.expectedBankCode).toBe('');           // embryo case → no bank code
    expect(c.expectedItems).toHaveLength(2);
    expect(c.expectedItems[0].fields.location.expected).toBe('E23G6T');
    expect(c.expectedItems[0].fields.colorCassettes.expected).toBe('Green');
    expect(c.expectedItems[1].fields.location.expected).toBe('E25G1G');
  });
  it('extracts the sperm bank code for 266 cases', () => {
    const c = buildCase(sperm, DATE);
    expect(c.expectedBankCode).toBe('2414418');
    expect(blankAudit(c, 'NTV').bank.expected).toBe('2414418');
  });
});

describe('validateAudit — sperm bank code', () => {
  function validSperm(): AuditRecord {
    const rec = blankAudit(buildCase(sperm, DATE), 'NTV');
    rec.sampleCheck = 'Đúng';
    rec.signatures = rec.cfCompliance = rec.storageCompliance = rec.discardingProc = 'YES';
    rec.finalResult = 'Đạt';
    rec.items.forEach(it => { it.verdict = 'Đạt'; });
    return rec;
  }
  it('requires a bank-code check when a bank code is expected', () => {
    expect(validateAudit(validSperm())).toMatch(/Sperm bank code/);
  });
  it('passes once the bank code is ticked', () => {
    const r = validSperm(); r.bank.check = 'Đúng';
    expect(validateAudit(r)).toBe('');
  });
});

describe('validateAudit', () => {
  function valid(): AuditRecord {
    const rec = blankAudit(buildCase(anh, DATE), 'NTV');
    rec.sampleCheck = 'Đúng';
    rec.signatures = rec.cfCompliance = rec.storageCompliance = rec.discardingProc = 'YES';
    rec.finalResult = 'Đạt';
    rec.items.forEach(it => { it.verdict = 'Đạt'; });
    return rec;
  }
  it('passes a complete record', () => { expect(validateAudit(valid())).toBe(''); });
  it('flags missing compliance', () => {
    const r = valid(); r.cfCompliance = '';
    expect(validateAudit(r)).toMatch(/Compliance/);
  });
  it('flags an item without a verdict', () => {
    const r = valid(); r.items[0].verdict = '';
    expect(validateAudit(r)).toMatch(/Item 1/);
  });
  it('flags a failed item missing the corrected value', () => {
    const r = valid(); r.items[0].verdict = 'Không đạt'; // expected present, actual blank
    expect(validateAudit(r)).toMatch(/giá trị đúng/);
  });
});

describe('complianceToOverlay', () => {
  it('maps YES/NO toggles to Yes/No overlay values', () => {
    const r = blankAudit(buildCase(anh, DATE), 'NTV');
    r.storageCompliance = 'NO'; r.cfCompliance = 'YES'; r.discardingProc = 'YES'; r.signatures = 'NO';
    expect(complianceToOverlay(r)).toEqual({ storage: 'No', cf: 'Yes', discarding: 'Yes', signatures: 'No' });
  });
});

describe('normalizeItem', () => {
  it('on Đạt copies expected into actual and marks Đúng', () => {
    const r = blankAudit(buildCase(anh, DATE), 'NTV');
    const it = r.items[0]; it.verdict = 'Đạt'; normalizeItem(it);
    expect(it.fields.location.actual).toBe('E23G6T');
    expect(it.fields.location.check).toBe('Đúng');
  });
  it('on Không đạt marks Sai when actual differs from expected', () => {
    const r = blankAudit(buildCase(anh, DATE), 'NTV');
    const it = r.items[0]; it.verdict = 'Không đạt';
    it.fields.location.actual = 'E23G6T';      // matches expected → Đúng
    it.fields.colorCassettes.actual = 'Red';   // differs from 'Green' → Sai
    normalizeItem(it);
    expect(it.fields.location.check).toBe('Đúng');
    expect(it.fields.colorCassettes.check).toBe('Sai');
  });
});
