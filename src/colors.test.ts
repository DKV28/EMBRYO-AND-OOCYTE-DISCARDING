import { describe, it, expect } from 'vitest';
import { translateColor } from './colors';

describe('translateColor', () => {
  it('translates confirmed colors', () => {
    expect(translateColor('ĐỎ')).toEqual({ value: 'Red', known: true });
    expect(translateColor('XANH LÁ')).toEqual({ value: 'Green', known: true });
    expect(translateColor('VÀNG')).toEqual({ value: 'Yellow', known: true });
    expect(translateColor('CAM')).toEqual({ value: 'Orange', known: true });
  });
  it('is whitespace/case tolerant', () => {
    expect(translateColor('  xanh   lá ')).toEqual({ value: 'Green', known: true });
  });
  it('passes unknown through, flagged not-known', () => {
    expect(translateColor('TÍM')).toEqual({ value: 'TÍM', known: false });
  });
});
