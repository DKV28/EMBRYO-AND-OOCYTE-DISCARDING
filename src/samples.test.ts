import { describe, it, expect } from 'vitest';
import { parseSampleTotals } from './samples';

describe('parseSampleTotals', () => {
  it('parses embryo total, ignores TEC device count', () => {
    expect(parseSampleTotals('3 PHÔI/3 TEC').samples).toEqual([{ type: 'Embryo', count: 3 }]);
    expect(parseSampleTotals('9 PHÔI/6 TEC').samples).toEqual([{ type: 'Embryo', count: 9 }]);
  });
  it('maps oocyte and sperm terms', () => {
    expect(parseSampleTotals('5 NOÃN/5 TEC').samples).toEqual([{ type: 'Oocyte', count: 5 }]);
    expect(parseSampleTotals('2 TINH TRÙNG/2 TEC').samples).toEqual([{ type: 'Sperm', count: 2 }]);
  });
  it('warns on unknown sample wording', () => {
    const r = parseSampleTotals('weird text');
    expect(r.samples).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
