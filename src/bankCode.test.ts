// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { bankCodeFromNote } from './bankCode';

describe('bankCodeFromNote', () => {
  it('strips the "MÃ NHTT:" label and returns the code', () => {
    expect(bankCodeFromNote('MÃ NHTT: 2414418')).toBe('2414418');
    expect(bankCodeFromNote('Mã NHTT 2414418')).toBe('2414418');
  });
  it('returns the note verbatim when there is no label', () => {
    expect(bankCodeFromNote('2414418')).toBe('2414418');
  });
  it('is blank for embryo/oocyte rows (no note)', () => {
    expect(bankCodeFromNote('N/A')).toBe('');
    expect(bankCodeFromNote('')).toBe('');
  });
});
