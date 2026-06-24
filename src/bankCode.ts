// Sperm-bank code helper. For sperm (266) samples the bank code lives in the
// "Ghi chú" note (e.g. "MÃ NHTT: 2414418"); return just the digit sequence (the
// longest run of digits). Embryo/oocyte rows carry note 'N/A' → blank.
export function bankCodeFromNote(note: string): string {
  if (!note || note === 'N/A') return '';
  const nums = note.match(/\d+/g);
  if (!nums) return '';
  return nums.reduce((a, b) => (b.length >= a.length ? b : a), '');
}
