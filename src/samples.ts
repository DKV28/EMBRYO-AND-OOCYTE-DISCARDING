import type { SampleType, SampleCount } from './types';

// Multi-word keyword checked before single-word to avoid partial matches.
const TYPE_MAP: { keyword: string; type: SampleType }[] = [
  { keyword: 'TINH TRÙNG', type: 'Sperm' },
  { keyword: 'PHÔI', type: 'Embryo' },
  { keyword: 'NOÃN', type: 'Oocyte' },
];

export function parseSampleTotals(raw: string): { samples: SampleCount[]; warnings: string[] } {
  const warnings: string[] = [];
  const samples: SampleCount[] = [];
  for (const seg of raw.split('/')) {
    const s = seg.trim();
    if (!s || /TEC/i.test(s)) continue;          // TEC = device count, not a sample column
    const m = /(\d+)\s*(.+)/.exec(s);
    if (!m) continue;
    const count = parseInt(m[1], 10);
    const word = m[2].trim().toUpperCase();
    const hit = TYPE_MAP.find(t => word.includes(t.keyword));
    if (hit) samples.push({ type: hit.type, count });
    else warnings.push(`Unknown sample type "${s}"`);
  }
  if (samples.length === 0) warnings.push(`Could not parse sample totals from "${raw}"`);
  return { samples, warnings };
}
