// Sperm-bank code helper. For sperm (266) samples the bank code lives in the
// "Ghi chú" note (e.g. "MÃ NHTT: 2414418"); strip that label and return the code.
// Embryo/oocyte rows carry note 'N/A' → blank.
export function bankCodeFromNote(note: string): string {
  if (!note || note === 'N/A') return '';
  const m = note.match(/nhtt\s*:?\s*(\S.*)$/i);
  return (m ? m[1] : note).trim();
}
