// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { bankCodeFromNote } from './bankCode';

describe('bankCodeFromNote', () => {
  it('returns only the digit sequence from the note', () => {
    expect(bankCodeFromNote('MÃ NHTT: 2414418')).toBe('2414418');
    expect(bankCodeFromNote('Mã NHTT 2414418')).toBe('2414418');
    expect(bankCodeFromNote('2414418')).toBe('2414418');
  });
  it('picks the longest digit run when extra text/numbers are present', () => {
    expect(bankCodeFromNote('NHTT 2414418 - 5 mẫu')).toBe('2414418');
  });
  it('is blank for embryo/oocyte rows or notes without digits', () => {
    expect(bankCodeFromNote('N/A')).toBe('');
    expect(bankCodeFromNote('')).toBe('');
    expect(bankCodeFromNote('ghi chú')).toBe('');
  });
});
