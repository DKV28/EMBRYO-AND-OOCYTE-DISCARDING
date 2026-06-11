// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { serializeSession, deserializeSession, type SessionState } from './session';
import type { RawRecord } from './types';

const rec: RawRecord = {
  fileName: 'A.pdf', form: '267', wifeName: 'W', husbandName: 'H',
  wifePID: '2', husbandPID: '1', orDate: new Date(Date.UTC(2025, 2, 4)), freezeDate: null,
  samples: [{ type: 'Embryo', count: 9 }],
  columns: [{ location: 'E19G9T', cassetteNo: 1, cassetteColorVi: 'ĐỎ', tecNo: 1, tecColorVi: 'VÀNG', biopsy: '' }],
  warnings: [],
};

const state: SessionState = {
  discardingDate: '2026-06-10',
  auditor: 'Nguyen Tuong Vy',
  records: [rec],
  compliance: { 'M: 1\nF: 2|E19G9T': { storage: 'N/A', cf: 'Yes', discarding: 'Yes', signatures: 'No' } },
};

describe('session serialize/deserialize', () => {
  it('round-trips state, reviving dates and preserving compliance', () => {
    const back = deserializeSession(serializeSession(state));
    expect(back.discardingDate).toBe('2026-06-10');
    expect(back.auditor).toBe('Nguyen Tuong Vy');
    expect(back.records[0].orDate).toEqual(new Date(Date.UTC(2025, 2, 4)));
    expect(back.records[0].freezeDate).toBeNull();
    expect(back.compliance['M: 1\nF: 2|E19G9T'].signatures).toBe('No');
  });

  it('rejects an unknown schema version', () => {
    const bad = JSON.stringify({ schemaVersion: 999 });
    expect(() => deserializeSession(bad)).toThrow(/schema version/);
  });
});
