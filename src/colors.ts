const MAP: Record<string, string> = {
  'ĐỎ': 'Red',
  'XANH LÁ': 'Green',
  'VÀNG': 'Yellow',
  'CAM': 'Orange',
  'TRẮNG': 'White',
  'HỒNG': 'Pink',
  'KEM': 'Cream',
  'XANH DƯƠNG': 'Blue',
  'XANH BIỂN': 'Blue',
};

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function translateColor(vi: string): { value: string; known: boolean } {
  const key = norm(vi);
  if (key in MAP) return { value: MAP[key], known: true };
  return { value: vi.trim(), known: false };
}
