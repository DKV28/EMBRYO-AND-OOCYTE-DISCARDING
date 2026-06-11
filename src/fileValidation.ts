// Pre-parse checks for user-picked files. Each rejection carries a human-readable
// reason so the UI can show *why* a file was dropped instead of skipping silently.
// Kept pure and synchronous (reads only File metadata) so it is easy to unit-test;
// malformed-but-PDF content is still caught later by the parser.

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB — real records are ~120 KB.

export type FileValidation = { ok: true } | { ok: false; reason: string };

export function validateFile(file: File, existingNames: Iterable<string>): FileValidation {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return { ok: false, reason: 'not a PDF' };
  if (file.size === 0) return { ok: false, reason: 'file is empty' };
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, reason: `too large (max ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB)` };
  }
  const names = existingNames instanceof Set ? existingNames : new Set(existingNames);
  if (names.has(file.name)) return { ok: false, reason: 'already added' };
  return { ok: true };
}
