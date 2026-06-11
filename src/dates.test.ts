import { describe, it, expect } from 'vitest';
import { parseVnDate, nearestWednesday, formatYmd, formatDmy } from './dates';

describe('parseVnDate', () => {
  it('parses DD/MM/YYYY', () => {
    const d = parseVnDate('29/04/2025')!;
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]).toEqual([2025, 3, 29]);
  });
  it('returns UTC midnight (app-wide calendar-date convention)', () => {
    expect(parseVnDate('14/11/2025')!.toISOString()).toBe('2025-11-14T00:00:00.000Z');
  });
  it('returns null for junk', () => { expect(parseVnDate('not a date')).toBeNull(); });
  it('returns null for impossible dates', () => { expect(parseVnDate('31/02/2025')).toBeNull(); });
});

describe('nearestWednesday', () => {
  it('from Monday 2026-06-08 picks Wed 2026-06-10', () => {
    expect(formatYmd(nearestWednesday(new Date(2026, 5, 8)))).toBe('2026-06-10');
  });
  it('on a Wednesday returns that day', () => {
    expect(formatYmd(nearestWednesday(new Date(2026, 5, 10)))).toBe('2026-06-10');
  });
});

describe('formatters', () => {
  it('formatYmd', () => { expect(formatYmd(new Date(Date.UTC(2026, 5, 3)))).toBe('2026-06-03'); });
  it('formatDmy', () => { expect(formatDmy(new Date(Date.UTC(2026, 5, 3)))).toBe('03/06/2026'); });
});
