import { describe, it, expect } from 'vitest';
import { validateFile, MAX_PDF_BYTES } from './fileValidation';

// validateFile reads only name/size/type, so a plain shaped object is enough.
const f = (name: string, size: number, type = 'application/pdf') => ({ name, size, type } as File);

describe('validateFile', () => {
  it('accepts a normal PDF', () => {
    expect(validateFile(f('a.pdf', 1000), [])).toEqual({ ok: true });
  });
  it('accepts a PDF by extension even when the MIME type is missing', () => {
    expect(validateFile(f('a.PDF', 1000, ''), [])).toEqual({ ok: true });
  });
  it('rejects non-PDF files', () => {
    expect(validateFile(f('notes.txt', 1000, 'text/plain'), [])).toEqual({ ok: false, reason: 'not a PDF' });
  });
  it('rejects empty files', () => {
    expect(validateFile(f('a.pdf', 0), [])).toEqual({ ok: false, reason: 'file is empty' });
  });
  it('rejects oversized files', () => {
    const r = validateFile(f('a.pdf', MAX_PDF_BYTES + 1), []);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/too large/);
  });
  it('rejects duplicates from an array or a Set of existing names', () => {
    expect(validateFile(f('a.pdf', 1000), ['a.pdf'])).toEqual({ ok: false, reason: 'already added' });
    expect(validateFile(f('a.pdf', 1000), new Set(['a.pdf']))).toEqual({ ok: false, reason: 'already added' });
  });
});
