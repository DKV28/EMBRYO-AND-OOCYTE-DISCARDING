# Discarding Audit Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, client-side web app that converts Tâm Anh `TA2.HSBA.267` embryo-destruction PDFs into a downloadable Excel audit matching `samples/desired_output.xlsx`.

**Architecture:** Vite + vanilla TypeScript, no UI framework. PDFs parsed in-browser with pdf.js (word + coordinate extraction → pure parser), transformed to output rows by a pure function, rendered both to an on-page preview and to an `.xlsx` via ExcelJS. Nothing is uploaded. Deployed static to Vercel.

**Tech Stack:** Vite, TypeScript, pdfjs-dist, exceljs, Vitest (+ jsdom), vite-plugin-node-polyfills (ExcelJS needs buffer/stream in-browser).

See spec: `docs/superpowers/specs/2026-06-08-discarding-audit-builder-design.md`.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | scaffold/config |
| `src/types.ts` | shared types (no logic) |
| `src/dates.ts` | `parseVnDate`, `nearestWednesday`, `formatYmd`, `formatDmy` |
| `src/colors.ts` | `translateColor` (Vietnamese→English) |
| `src/samples.ts` | `parseSampleTotals` (parse "Tổng số mẫu hủy") |
| `src/transform.ts` | `transform(records, date)` → `OutputRow[]` (pure core) |
| `src/excelWriter.ts` | `buildWorkbook`, `workbookBlob` (ExcelJS) |
| `src/pdfParser.ts` | `extractPdfItems` (pdf.js) + `parseRecordFromItems` (pure) |
| `src/preview.ts` | `renderPreview(rows)` → `HTMLTableElement` |
| `src/main.ts` | DOM wiring: files, reorder, statuses, preview, download |
| `src/style.css` | styling |
| `src/*.test.ts` | Vitest unit/integration tests |

---

## Task 1: Project scaffold + types

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/types.ts`, `src/style.css`, `src/main.ts` (stub), `src/smoke.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "discarding-audit-builder",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "exceljs": "^4.4.0",
    "pdfjs-dist": "^4.10.38"
  },
  "devDependencies": {
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vite-plugin-node-polyfills": "^0.22.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [nodePolyfills({ include: ['buffer', 'process', 'stream', 'util'] })],
  test: { environment: 'jsdom', globals: true },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Discarding Audit Builder</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <main id="app">
      <h1>Discarding Audit Builder</h1>
      <p class="sub">Drop the patient destruction PDFs — everything stays in your browser.</p>

      <label class="date-row">Discarding date
        <input type="date" id="discardDate" />
      </label>

      <div id="dropzone" class="dropzone">
        <input type="file" id="fileInput" accept="application/pdf" multiple hidden />
        <span>Drop PDFs here, or <button type="button" id="pickBtn">choose files</button></span>
      </div>

      <ul id="fileList" class="file-list"></ul>
      <div id="messages" class="messages"></div>

      <h2>Preview</h2>
      <div id="preview" class="preview"></div>

      <button id="downloadBtn" type="button" disabled>Download Excel</button>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/types.ts`**

```ts
export type SampleType = 'Embryo' | 'Oocyte' | 'Sperm';
export interface SampleCount { type: SampleType; count: number; }

export interface RawColumn {
  location: string;
  cassetteNo: number;
  cassetteColorVi: string;
  tecNo: number;
  tecColorVi: string;
  biopsy: string;
}

export interface RawRecord {
  fileName: string;
  wifeName: string;
  husbandName: string;
  wifePID: string;
  husbandPID: string;
  orDate: Date | null;
  samples: SampleCount[];
  columns: RawColumn[];
  warnings: string[];
}

export interface OutputRow {
  no: number | null;
  discardingDate: Date | null;
  pid: string | null;
  orDate: Date | null;
  embryo: number | null;
  oocyte: number | null;
  sperm: number | null;
  location: string;
  numCassettes: number;
  cassetteColor: string;
  numTec: number;
  tecColor: string;
  storageCompliance: string;
  cfCompliance: string;
  discardingProcedure: string;
  isCaseStart: boolean;
  caseRowSpan: number;
}

export interface TextItem { str: string; x: number; y: number; }
```

- [ ] **Step 6: Create `src/style.css`**

```css
:root { font-family: system-ui, sans-serif; color: #1a1a1a; }
#app { max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
h1 { margin-bottom: .25rem; }
.sub { color: #555; margin-top: 0; }
.date-row { display: inline-flex; gap: .5rem; align-items: center; margin: 1rem 0; }
.dropzone { border: 2px dashed #9aa; border-radius: 10px; padding: 2rem; text-align: center; background: #fafbfc; }
.dropzone.drag { background: #eef6ff; border-color: #3b82f6; }
.file-list { list-style: none; padding: 0; }
.file-list li { display: flex; gap: .5rem; align-items: center; padding: .4rem .6rem; border: 1px solid #eee; border-radius: 6px; margin: .25rem 0; }
.file-list .ok { color: #15803d; } .file-list .err { color: #b91c1c; } .file-list .warn { color: #b45309; }
.file-list .name { flex: 1; }
.messages { color: #b45309; font-size: .9rem; white-space: pre-wrap; }
.preview { overflow-x: auto; }
.preview table { border-collapse: collapse; font-size: .85rem; }
.preview th, .preview td { border: 1px solid #ccc; padding: 3px 6px; text-align: center; vertical-align: middle; }
.preview thead th { background: #fff2cc; }
.preview thead th.group-sample, .preview thead th.group-compliance { background: #ead1dc; }
button { cursor: pointer; padding: .4rem .8rem; }
#downloadBtn { margin-top: 1rem; font-size: 1rem; padding: .6rem 1.2rem; }
#downloadBtn:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 7: Create `src/main.ts` (stub)**

```ts
// Wired up in Task 10.
export {};
```

- [ ] **Step 8: Create `src/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('tooling', () => {
  it('runs vitest', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 9: Install dependencies**

Run: `cd /home/olokat/Documents/Python/smis3 && npm install`
Expected: dependencies installed, `node_modules/` present, no fatal errors.

- [ ] **Step 10: Run the smoke test**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+TS app, types, smoke test"
```

---

## Task 2: `dates.ts`

**Files:**
- Create: `src/dates.ts`, `src/dates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseVnDate, nearestWednesday, formatYmd, formatDmy } from './dates';

describe('parseVnDate', () => {
  it('parses DD/MM/YYYY', () => {
    const d = parseVnDate('29/04/2025')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2025, 3, 29]);
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
  it('formatYmd', () => { expect(formatYmd(new Date(2026, 5, 3))).toBe('2026-06-03'); });
  it('formatDmy', () => { expect(formatDmy(new Date(2026, 5, 3))).toBe('03/06/2026'); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/dates.test.ts`
Expected: FAIL ("Failed to resolve import './dates'").

- [ ] **Step 3: Write the implementation**

```ts
export function parseVnDate(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const day = +m[1], month = +m[2], year = +m[3];
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function nearestWednesday(from: Date): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let best = base, bestDist = Infinity;
  for (let delta = -6; delta <= 6; delta++) {
    const c = new Date(base); c.setDate(base.getDate() + delta);
    if (c.getDay() === 3) {                 // Wednesday
      const dist = Math.abs(delta);
      if (dist < bestDist || (dist === bestDist && delta > 0)) { best = c; bestDist = dist; }
    }
  }
  return best;
}

const pad = (n: number) => String(n).padStart(2, '0');
export function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function formatDmy(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dates.ts src/dates.test.ts
git commit -m "feat: date parsing, nearest-Wednesday, formatters"
```

---

## Task 3: `colors.ts`

**Files:**
- Create: `src/colors.ts`, `src/colors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/colors.test.ts`
Expected: FAIL (cannot resolve './colors').

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/colors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/colors.ts src/colors.test.ts
git commit -m "feat: Vietnamese→English color translation"
```

---

## Task 4: `samples.ts`

**Files:**
- Create: `src/samples.ts`, `src/samples.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/samples.test.ts`
Expected: FAIL (cannot resolve './samples').

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/samples.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/samples.ts src/samples.test.ts
git commit -m "feat: parse 'Tổng số mẫu hủy' sample totals"
```

---

## Task 5: `transform.ts` (core)

**Files:**
- Create: `src/transform.ts`, `src/transform.test.ts`

- [ ] **Step 1: Write the failing test** (uses the 3 real samples' known data)

```ts
import { describe, it, expect } from 'vitest';
import { transform } from './transform';
import type { RawRecord } from './types';

const hoa: RawRecord = {
  fileName: 'HOA.pdf', wifeName: 'NGUYỄN THỊ KIM HOA', husbandName: 'PHẠM XUÂN LỘC',
  wifePID: '2510039262', husbandPID: '2510039264', orDate: new Date(2025, 2, 4),
  samples: [{ type: 'Embryo', count: 9 }],
  columns: [2, 2, 2, 3, 3, 3].map((c, i) => ({
    location: 'E19G9T', cassetteNo: c, cassetteColorVi: 'ĐỎ',
    tecNo: i + 2, tecColorVi: 'VÀNG', biopsy: '',
  })),
  warnings: [],
};

const anh: RawRecord = {
  fileName: 'ANH.pdf', wifeName: 'NGUYỄN THỊ NGUYỆT ÁNH', husbandName: 'PHẠM HOÀNG LAM',
  wifePID: '2410001993', husbandPID: '2410001994', orDate: new Date(2025, 5, 9),
  samples: [{ type: 'Embryo', count: 2 }],
  columns: [
    { location: 'E23G6T', cassetteNo: 1, cassetteColorVi: 'XANH LÁ', tecNo: 1, tecColorVi: 'VÀNG', biopsy: '25TAH158-E1' },
    { location: 'E25G1G', cassetteNo: 2, cassetteColorVi: 'CAM', tecNo: 2, tecColorVi: 'XANH LÁ', biopsy: '25TAH158-E2' },
  ],
  warnings: [],
};

const DATE = new Date(2026, 5, 10);

describe('transform', () => {
  it('Hoa: one location, distinct cassette count 2, 6 tec', () => {
    const { rows } = transform([hoa], DATE);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      no: 1, pid: 'M: 2510039264\nF: 2510039262', embryo: 9, oocyte: null, sperm: null,
      location: 'E19G9T', numCassettes: 2, cassetteColor: 'Red', numTec: 6, tecColor: 'Yellow',
      storageCompliance: 'N/A', cfCompliance: 'Yes', discardingProcedure: 'Yes',
      isCaseStart: true, caseRowSpan: 1,
    });
    expect(rows[0].discardingDate).toEqual(DATE);
    expect(rows[0].orDate).toEqual(new Date(2025, 2, 4));
  });

  it('Ánh: two locations → two rows, patient fields only on first', () => {
    const { rows } = transform([anh], DATE);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ no: 1, location: 'E23G6T', numCassettes: 1, cassetteColor: 'Green', numTec: 1, tecColor: 'Yellow', isCaseStart: true, caseRowSpan: 2 });
    expect(rows[1]).toMatchObject({ no: null, pid: null, orDate: null, embryo: null, location: 'E25G1G', numCassettes: 1, cassetteColor: 'Orange', numTec: 1, tecColor: 'Green', isCaseStart: false, caseRowSpan: 2 });
  });

  it('numbers records by list order', () => {
    const { rows } = transform([hoa, anh], DATE);
    expect(rows[0].no).toBe(1);
    expect(rows.find(r => r.location === 'E23G6T')!.no).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/transform.test.ts`
Expected: FAIL (cannot resolve './transform').

- [ ] **Step 3: Write the implementation**

```ts
import type { RawRecord, RawColumn, OutputRow, SampleType } from './types';
import { translateColor } from './colors';

export interface TransformResult { rows: OutputRow[]; warnings: string[]; }

export function transform(records: RawRecord[], discardingDate: Date): TransformResult {
  const rows: OutputRow[] = [];
  const warnings: string[] = [];

  records.forEach((rec, idx) => {
    const no = idx + 1;
    const tag = rec.fileName;
    rec.warnings.forEach(w => warnings.push(`[${tag}] ${w}`));

    // Group columns by location, preserving first-appearance order.
    const order: string[] = [];
    const groups = new Map<string, RawColumn[]>();
    for (const col of rec.columns) {
      if (!groups.has(col.location)) { groups.set(col.location, []); order.push(col.location); }
      groups.get(col.location)!.push(col);
    }
    if (order.length === 0) { warnings.push(`[${tag}] no storage locations found`); return; }

    const pid = `M: ${rec.husbandPID}\nF: ${rec.wifePID}`;
    const sampleCount = (t: SampleType) => rec.samples.find(s => s.type === t)?.count ?? null;

    order.forEach((loc, gi) => {
      const cols = groups.get(loc)!;
      if (new Set(cols.map(c => c.cassetteColorVi)).size > 1) warnings.push(`[${tag}] ${loc}: mixed cassette colors, using first`);
      if (new Set(cols.map(c => c.tecColorVi)).size > 1) warnings.push(`[${tag}] ${loc}: mixed tec colors, using first`);
      const cass = translateColor(cols[0].cassetteColorVi);
      const tec = translateColor(cols[0].tecColorVi);
      if (!cass.known) warnings.push(`[${tag}] unknown cassette color "${cols[0].cassetteColorVi}"`);
      if (!tec.known) warnings.push(`[${tag}] unknown tec color "${cols[0].tecColorVi}"`);
      const start = gi === 0;
      rows.push({
        no: start ? no : null,
        discardingDate: start ? discardingDate : null,
        pid: start ? pid : null,
        orDate: start ? rec.orDate : null,
        embryo: start ? sampleCount('Embryo') : null,
        oocyte: start ? sampleCount('Oocyte') : null,
        sperm: start ? sampleCount('Sperm') : null,
        location: loc,
        numCassettes: new Set(cols.map(c => c.cassetteNo)).size,
        cassetteColor: cass.value,
        numTec: cols.length,
        tecColor: tec.value,
        storageCompliance: 'N/A',
        cfCompliance: 'Yes',
        discardingProcedure: 'Yes',
        isCaseStart: start,
        caseRowSpan: order.length,
      });
    });
  });

  return { rows, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/transform.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/transform.ts src/transform.test.ts
git commit -m "feat: transform raw records to output rows"
```

---

## Task 6: `excelWriter.ts`

**Files:**
- Create: `src/excelWriter.ts`, `src/excelWriter.test.ts`

- [ ] **Step 1: Write the failing test** (write, then read back, assert structure)

```ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from './excelWriter';
import type { OutputRow } from './types';

function baseRow(over: Partial<OutputRow>): OutputRow {
  return {
    no: null, discardingDate: null, pid: null, orDate: null, embryo: null, oocyte: null, sperm: null,
    location: 'X', numCassettes: 1, cassetteColor: 'Red', numTec: 1, tecColor: 'Green',
    storageCompliance: 'N/A', cfCompliance: 'Yes', discardingProcedure: 'Yes',
    isCaseStart: true, caseRowSpan: 1, ...over,
  };
}

const rows: OutputRow[] = [
  baseRow({ no: 1, discardingDate: new Date(2026, 5, 10), pid: 'M: 1\nF: 2', orDate: new Date(2025, 2, 4), embryo: 9, location: 'E19G9T', numCassettes: 2, numTec: 6, tecColor: 'Yellow', caseRowSpan: 1 }),
  baseRow({ no: 2, discardingDate: new Date(2026, 5, 10), pid: 'M: 3\nF: 4', orDate: new Date(2025, 5, 9), embryo: 2, location: 'E23G6T', cassetteColor: 'Green', tecColor: 'Yellow', isCaseStart: true, caseRowSpan: 2 }),
  baseRow({ location: 'E25G1G', cassetteColor: 'Orange', tecColor: 'Green', isCaseStart: false, caseRowSpan: 2 }),
];

describe('buildWorkbook', () => {
  it('produces the expected header, merges, formats, dropdowns, total', async () => {
    const wb = await buildWorkbook(rows);
    const buf = await wb.xlsx.writeBuffer();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buf);
    const ws = wb2.getWorksheet('Trang tính1')!;
    expect(ws).toBeTruthy();
    expect(ws.getCell('A1').value).toBe('No.');
    expect(ws.getCell('E1').value).toBe('Sample');
    expect(ws.getCell('M1').value).toBe('Compliance');
    expect(ws.getCell('G2').value).toBe('Sperm');

    const merges: string[] = (ws as any).model.merges;
    expect(merges).toEqual(expect.arrayContaining(['E1:G1', 'M1:O1', 'A1:A2']));
    // multi-location case (rows 4-5) merges col A vertically
    expect(merges).toEqual(expect.arrayContaining(['A4:A5']));

    expect(ws.getCell('B3').numFmt.toLowerCase()).toContain('dd');
    expect(ws.getCell('C3').value).toContain('\n');
    expect(ws.getCell('M3').dataValidation?.type).toBe('list');

    // Total row after 3 data rows (rows 3,4,5) → row 6
    expect(ws.getCell('D6').value).toBe('Total');
    const e6 = ws.getCell('E6').value as any;
    expect(e6.formula ?? e6).toContain('SUM(E3:E5)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/excelWriter.test.ts`
Expected: FAIL (cannot resolve './excelWriter').

- [ ] **Step 3: Write the implementation**

```ts
import ExcelJS from 'exceljs';
import type { OutputRow } from './types';

const CREAM = 'FFFFF2CC';
const PINK = 'FFEAD1DC';

function styleHeader(cell: ExcelJS.Cell, text: string, fill: string) {
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, bold: true };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
}

export async function buildWorkbook(rows: OutputRow[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Trang tính1');

  // --- Header (rows 1-2) ---
  ws.mergeCells('A1:A2'); styleHeader(ws.getCell('A1'), 'No.', CREAM);
  ws.mergeCells('B1:B2'); styleHeader(ws.getCell('B1'), 'Discarding date', CREAM);
  ws.mergeCells('C1:C2'); styleHeader(ws.getCell('C1'), 'PID', CREAM);
  ws.mergeCells('D1:D2'); styleHeader(ws.getCell('D1'), 'OR Date', CREAM);
  ws.mergeCells('E1:G1'); styleHeader(ws.getCell('E1'), 'Sample', PINK);
  styleHeader(ws.getCell('E2'), 'Embryo', PINK);
  styleHeader(ws.getCell('F2'), 'Oocyte', PINK);
  styleHeader(ws.getCell('G2'), 'Sperm', PINK);
  ws.mergeCells('H1:H2'); styleHeader(ws.getCell('H1'), 'Location', CREAM);
  ws.mergeCells('I1:I2'); styleHeader(ws.getCell('I1'), 'Number of cassettes', CREAM);
  ws.mergeCells('J1:J2'); styleHeader(ws.getCell('J1'), 'Color of cassettes', CREAM);
  ws.mergeCells('K1:K2'); styleHeader(ws.getCell('K1'), 'Number of tec', CREAM);
  ws.mergeCells('L1:L2'); styleHeader(ws.getCell('L1'), 'Color of tec', CREAM);
  ws.mergeCells('M1:O1'); styleHeader(ws.getCell('M1'), 'Compliance', PINK);
  styleHeader(ws.getCell('M2'), 'Storage\nCompliance', PINK);
  styleHeader(ws.getCell('N2'), 'CF\nCompliance', PINK);
  styleHeader(ws.getCell('O2'), 'Discarding\nProcedure', PINK);

  // --- Data (from row 3) ---
  const FIRST = 3;
  rows.forEach((r, i) => {
    const rn = FIRST + i;
    const row = ws.getRow(rn);
    const set = (col: number, value: ExcelJS.CellValue) => { row.getCell(col).value = value; };
    if (r.isCaseStart) {
      set(1, r.no);
      if (r.discardingDate) { row.getCell(2).value = r.discardingDate; row.getCell(2).numFmt = 'dd/mm/yyyy'; }
      set(3, r.pid);
      if (r.orDate) { row.getCell(4).value = r.orDate; row.getCell(4).numFmt = 'dd/mm/yyyy'; }
      set(5, r.embryo); set(6, r.oocyte); set(7, r.sperm);
    }
    set(8, r.location);
    set(9, r.numCassettes); set(10, r.cassetteColor);
    set(11, r.numTec); set(12, r.tecColor);
    set(13, r.storageCompliance); set(14, r.cfCompliance); set(15, r.discardingProcedure);

    // styling: Calibri 11, wrap, vcenter; PID + others centered (PID left)
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: c === 3 ? 'left' : 'center', wrapText: true };
    }
    // Compliance dropdowns on M,N,O
    for (let c = 13; c <= 15; c++) {
      row.getCell(c).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No,N/A"'] };
    }
  });

  // --- Vertical merges for multi-location cases (cols A–G) ---
  rows.forEach((r, i) => {
    if (r.isCaseStart && r.caseRowSpan > 1) {
      const top = FIRST + i, bottom = top + r.caseRowSpan - 1;
      for (let c = 1; c <= 7; c++) ws.mergeCells(top, c, bottom, c);
    }
  });

  // --- Total row ---
  const last = FIRST + rows.length - 1;
  const totalRn = last + 1;
  const totalRow = ws.getRow(totalRn);
  totalRow.getCell(4).value = 'Total';
  totalRow.getCell(4).font = { name: 'Calibri', size: 11, bold: true };
  totalRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
  const sumCols: { col: number; key: keyof OutputRow }[] = [
    { col: 5, key: 'embryo' }, { col: 6, key: 'oocyte' }, { col: 7, key: 'sperm' },
  ];
  for (const { col, key } of sumCols) {
    if (rows.some(r => r[key] != null)) {
      const L = ws.getColumn(col).letter;
      const cell = totalRow.getCell(col);
      cell.value = { formula: `SUM(${L}${FIRST}:${L}${last})` } as ExcelJS.CellFormulaValue;
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // --- Column widths ---
  const widths: Record<number, number> = { 1: 5, 2: 12, 3: 18, 4: 12, 5: 8, 6: 8, 7: 8, 8: 11, 9: 11, 10: 13, 11: 10, 12: 12, 13: 14.9, 14: 12, 15: 13 };
  for (const [c, w] of Object.entries(widths)) ws.getColumn(+c).width = w;

  return wb;
}

export async function workbookBlob(rows: OutputRow[]): Promise<Blob> {
  const wb = await buildWorkbook(rows);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/excelWriter.test.ts`
Expected: PASS. (If ExcelJS errors on `writeBuffer` in jsdom, add `import { Buffer } from 'buffer'; globalThis.Buffer = Buffer;` at top of test setup — but node test env provides Buffer.)

- [ ] **Step 5: Commit**

```bash
git add src/excelWriter.ts src/excelWriter.test.ts
git commit -m "feat: ExcelJS writer cloning the audit template"
```

---

## Task 7: `pdfParser.ts` — pure `parseRecordFromItems`

**Files:**
- Create: `src/pdfParser.ts`, `src/pdfParser.test.ts`

The parser splits into `extractPdfItems` (pdf.js, runtime) and `parseRecordFromItems` (pure, tested with synthetic items). Synthetic items reproduce the real layout geometry observed in design (label column at x≈80; value columns at x≈179/245/311…).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseRecordFromItems } from './pdfParser';
import type { TextItem } from './types';

// Helper: build a labelled line at a given y. Label tokens near x=80, values at given xs.
function line(y: number, label: string, values: { x: number; s: string }[]): TextItem[] {
  const items: TextItem[] = [];
  label.split(' ').forEach((w, i) => items.push({ str: w, x: 80 + i * 18, y }));
  for (const v of values) items.push({ str: v.s, x: v.x, y });
  return items;
}

// Reproduce the "Hoa" record geometry (6 columns at one location, cassettes {2,3}, 6 tec).
function hoaItems(): TextItem[] {
  const xs = [179, 245, 311, 377, 442, 508];
  const items: TextItem[] = [];
  items.push(...line(10, 'Họ tên vợ', [{ x: 179, s: 'NGUYỄN' }, { x: 215, s: 'THỊ' }, { x: 240, s: 'KIM' }, { x: 270, s: 'HOA' }]));
  items.push(...line(22, 'Ngày sinh', [{ x: 179, s: '22/04/1992' }]));
  items.push(...line(34, 'PID', [{ x: 179, s: '2510039262' }]));
  items.push(...line(46, 'Họ tên chồng', [{ x: 179, s: 'PHẠM' }, { x: 210, s: 'XUÂN' }, { x: 240, s: 'LỘC' }]));
  items.push(...line(58, 'Ngày sinh', [{ x: 179, s: '18/08/1988' }]));
  items.push(...line(70, 'PID', [{ x: 179, s: '2510039264' }]));
  items.push(...line(82, 'Ngày chọc hút', [{ x: 179, s: '04/03/2025' }]));
  items.push(...line(94, 'Vị trí cất', xs.map(x => ({ x, s: 'E19G9T' }))));
  items.push(...line(106, 'Stt cassette', [2, 2, 2, 3, 3, 3].map((c, i) => ({ x: xs[i], s: String(c) }))));
  items.push(...line(118, 'Màu cassette', xs.map(x => ({ x, s: 'ĐỎ' }))));
  items.push(...line(130, 'Stt tec', [2, 3, 4, 5, 6, 7].map((c, i) => ({ x: xs[i], s: String(c) }))));
  items.push(...line(142, 'Màu tec', xs.map(x => ({ x, s: 'VÀNG' }))));
  items.push(...line(154, 'Tổng số mẫu hủy', [{ x: 179, s: '9' }, { x: 192, s: 'PHÔI/6' }, { x: 230, s: 'TEC' }]));
  return items;
}

// Reproduce "Ánh": two locations, multi-word colors (XANH LÁ).
function anhItems(): TextItem[] {
  const xs = [179, 376];
  const items: TextItem[] = [];
  items.push(...line(10, 'Họ tên vợ', [{ x: 179, s: 'ÁNH' }]));
  items.push(...line(34, 'PID', [{ x: 179, s: '2410001993' }]));
  items.push(...line(46, 'Họ tên chồng', [{ x: 179, s: 'LAM' }]));
  items.push(...line(70, 'PID', [{ x: 179, s: '2410001994' }]));
  items.push(...line(82, 'Ngày chọc hút', [{ x: 179, s: '09/06/2025' }]));
  items.push(...line(94, 'Vị trí cất', [{ x: 179, s: 'E23G6T' }, { x: 376, s: 'E25G1G' }]));
  items.push(...line(106, 'Stt cassette', [{ x: 179, s: '1' }, { x: 376, s: '2' }]));
  items.push(...line(118, 'Màu cassette', [{ x: 179, s: 'XANH' }, { x: 200, s: 'LÁ' }, { x: 376, s: 'CAM' }]));
  items.push(...line(130, 'Stt tec', [{ x: 179, s: '1' }, { x: 376, s: '2' }]));
  items.push(...line(142, 'Màu tec', [{ x: 179, s: 'VÀNG' }, { x: 376, s: 'XANH' }, { x: 397, s: 'LÁ' }]));
  items.push(...line(154, 'Tổng số mẫu hủy', [{ x: 179, s: '2' }, { x: 192, s: 'PHÔI/2' }, { x: 230, s: 'TEC' }]));
  return items;
}

describe('parseRecordFromItems', () => {
  it('parses Hoa: PIDs, OR date, 9 embryo, 6 columns at one location', () => {
    const r = parseRecordFromItems(hoaItems(), 'HOA.pdf');
    expect(r.wifePID).toBe('2510039262');
    expect(r.husbandPID).toBe('2510039264');
    expect(r.orDate).toEqual(new Date(2025, 2, 4));
    expect(r.samples).toEqual([{ type: 'Embryo', count: 9 }]);
    expect(r.columns).toHaveLength(6);
    expect(r.columns.map(c => c.cassetteNo)).toEqual([2, 2, 2, 3, 3, 3]);
    expect(r.columns.map(c => c.tecNo)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(r.columns.every(c => c.location === 'E19G9T' && c.cassetteColorVi === 'ĐỎ' && c.tecColorVi === 'VÀNG')).toBe(true);
  });

  it('parses Ánh: two locations and merged multi-word colors', () => {
    const r = parseRecordFromItems(anhItems(), 'ANH.pdf');
    expect(r.columns).toHaveLength(2);
    expect(r.columns[0]).toMatchObject({ location: 'E23G6T', cassetteNo: 1, cassetteColorVi: 'XANH LÁ', tecNo: 1, tecColorVi: 'VÀNG' });
    expect(r.columns[1]).toMatchObject({ location: 'E25G1G', cassetteNo: 2, cassetteColorVi: 'CAM', tecNo: 2, tecColorVi: 'XANH LÁ' });
  });

  it('throws on a non-matching document', () => {
    const items: TextItem[] = [{ str: 'Some', x: 10, y: 10 }, { str: 'invoice', x: 40, y: 10 }];
    expect(() => parseRecordFromItems(items, 'x.pdf')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pdfParser.test.ts`
Expected: FAIL (cannot resolve './pdfParser').

- [ ] **Step 3: Write the implementation**

```ts
import type { TextItem, RawRecord, RawColumn } from './types';
import { parseVnDate } from './dates';
import { parseSampleTotals } from './samples';

const TABLE_LABELS = ['Vị trí cất', 'Stt cassette', 'Màu cassette', 'Stt tec', 'Màu tec', 'Mã sinh thiết'];

interface Line { y: number; items: TextItem[]; text: string; }

function buildLines(items: TextItem[]): Line[] {
  const sorted = [...items].filter(i => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  const Y_TOL = 4;
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= Y_TOL) last.push(it);
    else lines.push([it]);
  }
  return lines.map(l => {
    l.sort((a, b) => a.x - b.x);
    return { y: l[0].y, items: l, text: l.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim() };
  });
}

// Return value tokens after consuming the leading label tokens (by accumulated length).
function valueTokens(line: Line, label: string): TextItem[] {
  const toks = [...line.items].sort((a, b) => a.x - b.x);
  const targetLen = label.replace(/\s+/g, '').length;
  let acc = 0, i = 0;
  while (i < toks.length && acc < targetLen) { acc += toks[i].str.replace(/\s+/g, '').length; i++; }
  return toks.slice(i);
}

// Cluster x positions into column centers (first-seen within tolerance).
function columnCenters(allValueTokens: TextItem[]): number[] {
  const centers: number[] = [];
  const TOL = 25;
  for (const t of [...allValueTokens].sort((a, b) => a.x - b.x)) {
    if (!centers.some(c => Math.abs(c - t.x) <= TOL)) centers.push(t.x);
  }
  return centers.sort((a, b) => a - b);
}

// Assign tokens to nearest column center, join tokens sharing a column.
function rowCells(tokens: TextItem[], centers: number[]): string[] {
  const buckets: string[][] = centers.map(() => []);
  for (const t of tokens) {
    let bi = 0, bd = Infinity;
    centers.forEach((c, i) => { const d = Math.abs(c - t.x); if (d < bd) { bd = d; bi = i; } });
    buckets[bi].push(t.str);
  }
  return buckets.map(b => b.join(' ').replace(/\s+/g, ' ').trim());
}

export function parseRecordFromItems(items: TextItem[], fileName: string): RawRecord {
  const lines = buildLines(items);
  const fullText = lines.map(l => l.text).join('\n');
  if (!/Vị trí cất/.test(fullText) || !/Tổng số mẫu hủy/.test(fullText)) {
    throw new Error('Not a TA2.HSBA.267 destruction record (missing expected fields)');
  }
  const warnings: string[] = [];

  const valueAfter = (label: string, occurrence = 0): string | null => {
    let seen = 0;
    for (const l of lines) {
      if (l.text.startsWith(label)) {
        if (seen === occurrence) return l.text.slice(label.length).trim();
        seen++;
      }
    }
    return null;
  };

  const wifeName = valueAfter('Họ tên vợ') ?? '';
  const husbandName = valueAfter('Họ tên chồng') ?? '';
  const wifePID = valueAfter('PID', 0) ?? '';
  const husbandPID = valueAfter('PID', 1) ?? '';
  const orDate = parseVnDate(valueAfter('Ngày chọc hút') ?? '');
  if (!orDate) warnings.push('Could not parse OR date (Ngày chọc hút)');
  const { samples, warnings: sw } = parseSampleTotals(valueAfter('Tổng số mẫu hủy') ?? '');
  warnings.push(...sw);

  // Table block
  const tableLines = TABLE_LABELS.map(lbl => ({ lbl, line: lines.find(l => l.text.startsWith(lbl)) ?? null }));
  const valTokensByLabel = new Map<string, TextItem[]>();
  const pool: TextItem[] = [];
  for (const { lbl, line } of tableLines) {
    const v = line ? valueTokens(line, lbl) : [];
    valTokensByLabel.set(lbl, v);
    if (lbl !== 'Mã sinh thiết') pool.push(...v);   // biopsy may be blank; don't rely on it for centers
  }
  const centers = columnCenters(pool);
  const cell = (lbl: string) => rowCells(valTokensByLabel.get(lbl) ?? [], centers);
  const loc = cell('Vị trí cất'), cassNo = cell('Stt cassette'), cassCol = cell('Màu cassette');
  const tecNo = cell('Stt tec'), tecCol = cell('Màu tec'), biopsy = cell('Mã sinh thiết');

  const columns: RawColumn[] = [];
  for (let i = 0; i < centers.length; i++) {
    if (!loc[i]) continue;                          // no location in this column → skip
    columns.push({
      location: loc[i],
      cassetteNo: parseInt(cassNo[i], 10) || 0,
      cassetteColorVi: cassCol[i] ?? '',
      tecNo: parseInt(tecNo[i], 10) || 0,
      tecColorVi: tecCol[i] ?? '',
      biopsy: biopsy[i] ?? '',
    });
  }
  if (columns.length === 0) warnings.push('No storage-location columns parsed');

  return { fileName, wifeName, husbandName, wifePID, husbandPID, orDate, samples, columns, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pdfParser.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `extractPdfItems` (pdf.js wrapper, not unit-tested here)**

Append to `src/pdfParser.ts`:

```ts
// pdfjs is injected so the browser passes the web build and tests can pass the legacy build.
export async function extractPdfItems(data: Uint8Array, pdfjs: any): Promise<TextItem[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items as any[]) {
      if (typeof it.str !== 'string' || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: viewport.height - it.transform[5] });
    }
    return items;
  } finally {
    await doc.destroy();
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/pdfParser.ts src/pdfParser.test.ts
git commit -m "feat: PDF table parser (pure core + pdf.js extractor)"
```

---

## Task 8: Golden-master end-to-end test (real PDFs, gated)

**Files:**
- Create: `src/golden.e2e.test.ts`

This runs the **real** pdf.js (legacy build, Node) on the three sample PDFs in `samples/`, then transforms, and asserts the output matches the known values. It is **skipped** when `samples/` is absent (e.g. CI).

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractPdfItems, parseRecordFromItems } from './pdfParser';
import { transform } from './transform';

const dir = fileURLToPath(new URL('../samples/', import.meta.url));
const FILES = {
  tam: 'LÊ THỊ TÂM done.pdf',
  hoa: 'NGUYỄN THỊ KIM HOA done.pdf',
  anh: 'NGUYỄN THỊ NGUYỆT ÁNH done.pdf',
};
const haveAll = Object.values(FILES).every(f => existsSync(dir + f));

describe.skipIf(!haveAll)('golden master (real PDFs)', () => {
  it('reproduces desired_output cases 2–4 (renumbered 1–3)', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const records = [];
    for (const f of [FILES.tam, FILES.hoa, FILES.anh]) {
      const data = new Uint8Array(readFileSync(dir + f));
      const items = await extractPdfItems(data, pdfjs);
      records.push(parseRecordFromItems(items, f));
    }
    const { rows } = transform(records, new Date(2026, 5, 10));

    // Tâm: 1 row
    expect(rows[0]).toMatchObject({ no: 1, location: 'E6G1T', numCassettes: 3, cassetteColor: 'Red', numTec: 3, tecColor: 'Green', embryo: 3 });
    expect(rows[0].pid).toBe('M: 2510074101\nF: 2510074096');
    expect(rows[0].orDate).toEqual(new Date(2025, 3, 29));
    // Hoa: 1 row
    const hoa = rows.find(r => r.location === 'E19G9T')!;
    expect(hoa).toMatchObject({ no: 2, numCassettes: 2, cassetteColor: 'Red', numTec: 6, tecColor: 'Yellow', embryo: 9 });
    // Ánh: 2 rows
    const a1 = rows.find(r => r.location === 'E23G6T')!;
    const a2 = rows.find(r => r.location === 'E25G1G')!;
    expect(a1).toMatchObject({ no: 3, numCassettes: 1, cassetteColor: 'Green', numTec: 1, tecColor: 'Yellow', embryo: 2, caseRowSpan: 2 });
    expect(a2).toMatchObject({ no: null, numCassettes: 1, cassetteColor: 'Orange', numTec: 1, tecColor: 'Green' });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/golden.e2e.test.ts`
Expected: PASS (or SKIPPED if `samples/` PDFs absent). If pdf.js legacy emits a benign canvas/font warning, that is acceptable as long as assertions pass.

- [ ] **Step 3: Commit**

```bash
git add src/golden.e2e.test.ts
git commit -m "test: golden-master e2e against real sample PDFs"
```

> If this test reveals a parser mismatch (e.g. real pdf.js token boundaries differ from the synthetic fixtures), fix `parseRecordFromItems` and re-run Tasks 7–8 until green. This is the authoritative correctness gate.

---

## Task 9: `preview.ts`

**Files:**
- Create: `src/preview.ts`, `src/preview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { renderPreview } from './preview';
import type { OutputRow } from './types';

const rows: OutputRow[] = [
  { no: 1, discardingDate: new Date(2026, 5, 10), pid: 'M: 3\nF: 4', orDate: new Date(2025, 5, 9), embryo: 2, oocyte: null, sperm: null, location: 'E23G6T', numCassettes: 1, cassetteColor: 'Green', numTec: 1, tecColor: 'Yellow', storageCompliance: 'N/A', cfCompliance: 'Yes', discardingProcedure: 'Yes', isCaseStart: true, caseRowSpan: 2 },
  { no: null, discardingDate: null, pid: null, orDate: null, embryo: null, oocyte: null, sperm: null, location: 'E25G1G', numCassettes: 1, cassetteColor: 'Orange', numTec: 1, tecColor: 'Green', storageCompliance: 'N/A', cfCompliance: 'Yes', discardingProcedure: 'Yes', isCaseStart: false, caseRowSpan: 2 },
];

describe('renderPreview', () => {
  it('renders patient cell with rowspan and both location rows', () => {
    const table = renderPreview(rows);
    const bodyRows = table.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    const noCell = bodyRows[0].querySelector('td')!;
    expect(noCell.getAttribute('rowspan')).toBe('2');
    expect(table.textContent).toContain('E23G6T');
    expect(table.textContent).toContain('E25G1G');
    expect(table.textContent).toContain('09/06/2025'); // OR date formatted
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/preview.test.ts`
Expected: FAIL (cannot resolve './preview').

- [ ] **Step 3: Write the implementation**

```ts
import type { OutputRow } from './types';
import { formatDmy } from './dates';

function th(text: string, cls = '', attrs: Record<string, string> = {}): HTMLTableCellElement {
  const el = document.createElement('th');
  el.textContent = text; if (cls) el.className = cls;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function td(text: string, attrs: Record<string, string> = {}): HTMLTableCellElement {
  const el = document.createElement('td');
  el.innerHTML = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function renderPreview(rows: OutputRow[]): HTMLTableElement {
  const table = document.createElement('table');
  const thead = table.createTHead();
  const r1 = thead.insertRow();
  r1.append(
    th('No.', '', { rowspan: '2' }), th('Discarding date', '', { rowspan: '2' }),
    th('PID', '', { rowspan: '2' }), th('OR Date', '', { rowspan: '2' }),
    th('Sample', 'group-sample', { colspan: '3' }),
    th('Location', '', { rowspan: '2' }), th('Number of cassettes', '', { rowspan: '2' }),
    th('Color of cassettes', '', { rowspan: '2' }), th('Number of tec', '', { rowspan: '2' }),
    th('Color of tec', '', { rowspan: '2' }),
    th('Compliance', 'group-compliance', { colspan: '3' }),
  );
  const r2 = thead.insertRow();
  r2.append(
    th('Embryo', 'group-sample'), th('Oocyte', 'group-sample'), th('Sperm', 'group-sample'),
    th('Storage', 'group-compliance'), th('CF', 'group-compliance'), th('Discarding', 'group-compliance'),
  );

  const tbody = table.createTBody();
  const num = (n: number | null) => (n == null ? '' : String(n));
  const date = (d: Date | null) => (d ? formatDmy(d) : '');
  for (const r of rows) {
    const tr = tbody.insertRow();
    if (r.isCaseStart) {
      const span = r.caseRowSpan > 1 ? { rowspan: String(r.caseRowSpan) } : {};
      tr.append(
        td(num(r.no), span), td(date(r.discardingDate), span),
        td((r.pid ?? '').replace(/\n/g, '<br>'), span), td(date(r.orDate), span),
        td(num(r.embryo), span), td(num(r.oocyte), span), td(num(r.sperm), span),
      );
    }
    tr.append(
      td(r.location), td(num(r.numCassettes)), td(r.cassetteColor),
      td(num(r.numTec)), td(r.tecColor),
      td(r.storageCompliance), td(r.cfCompliance), td(r.discardingProcedure),
    );
  }
  return table;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/preview.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/preview.ts src/preview.test.ts
git commit -m "feat: on-page preview table mirroring the Excel"
```

---

## Task 10: `main.ts` — UI wiring + manual verification

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Write the implementation**

```ts
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractPdfItems, parseRecordFromItems } from './pdfParser';
import { transform } from './transform';
import { renderPreview } from './preview';
import { workbookBlob } from './excelWriter';
import { nearestWednesday, formatYmd } from './dates';
import type { RawRecord } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Entry { file: File; status: 'ok' | 'error'; record?: RawRecord; error?: string; }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dateInput = $<HTMLInputElement>('discardDate');
const fileInput = $<HTMLInputElement>('fileInput');
const dropzone = $<HTMLDivElement>('dropzone');
const fileList = $<HTMLUListElement>('fileList');
const messages = $<HTMLDivElement>('messages');
const preview = $<HTMLDivElement>('preview');
const downloadBtn = $<HTMLButtonElement>('downloadBtn');

dateInput.value = formatYmd(nearestWednesday(new Date()));

const entries: Entry[] = [];

async function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;
    if (entries.some(e => e.file.name === file.name)) continue;  // ignore duplicates
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const items = await extractPdfItems(data, pdfjs);
      const record = parseRecordFromItems(items, file.name);
      entries.push({ file, status: 'ok', record });
    } catch (err) {
      entries.push({ file, status: 'error', error: (err as Error).message });
    }
  }
  rerender();
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= entries.length) return;
  [entries[i], entries[j]] = [entries[j], entries[i]];
  rerender();
}
function remove(i: number) { entries.splice(i, 1); rerender(); }

function currentRows() {
  const recs = entries.filter(e => e.status === 'ok').map(e => e.record!);
  const date = dateInput.valueAsDate ?? new Date(dateInput.value);
  return transform(recs, date);
}

function rerender() {
  // file list
  fileList.innerHTML = '';
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    const status = document.createElement('span');
    if (e.status === 'ok') {
      const r = e.record!;
      const locs = new Set(r.columns.map(c => c.location)).size;
      const samp = r.samples.map(s => `${s.count} ${s.type}`).join(', ') || '—';
      status.className = r.warnings.length ? 'warn' : 'ok';
      status.textContent = r.warnings.length ? '⚠' : '✓';
      li.title = r.warnings.join('\n');
      li.append(status, nameSpan(`${r.wifeName || e.file.name} — ${locs} loc, ${samp}`));
    } else {
      status.className = 'err'; status.textContent = '✗';
      li.append(status, nameSpan(`${e.file.name} — ${e.error}`));
    }
    li.append(btn('↑', () => move(i, -1)), btn('↓', () => move(i, 1)), btn('✕', () => remove(i)));
    fileList.append(li);
  });

  const { rows, warnings } = currentRows();
  messages.textContent = warnings.join('\n');
  preview.innerHTML = '';
  if (rows.length) preview.append(renderPreview(rows));
  downloadBtn.disabled = rows.length === 0;
}

function nameSpan(text: string) { const s = document.createElement('span'); s.className = 'name'; s.textContent = text; return s; }
function btn(label: string, onClick: () => void) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = onClick; return b; }

$('pickBtn').onclick = () => fileInput.click();
fileInput.onchange = () => { if (fileInput.files) addFiles(fileInput.files); fileInput.value = ''; };
dateInput.onchange = rerender;
['dragover', 'dragenter'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', e => { if (e.dataTransfer?.files) addFiles(e.dataTransfer.files); });

downloadBtn.onclick = async () => {
  const { rows } = currentRows();
  if (!rows.length) return;
  const blob = await workbookBlob(rows);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Monitoring_Discarding audit ${dateInput.value}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all PASS (golden-master runs if `samples/` present).

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, open the local URL.
Do: drop the 3 PDFs from `samples/`; confirm:
- file list shows 3 ✓ rows with names/locations/sample counts;
- preview matches `samples/desired_output.xlsx` (Tâm 1 row, Hoa 1 row I=2/K=6, Ánh 2 rows merged);
- date defaults to a Wednesday;
- **Download** yields `Monitoring_Discarding audit <date>.xlsx`; open it and verify headers/merges/colors/dropdowns/Total.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire up UI — upload, reorder, preview, download"
```

---

## Task 11: Build + deploy to Vercel

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Discarding Audit Builder

Client-side web app: converts Tâm Anh `TA2.HSBA.267` embryo-destruction PDFs into
the discarding-audit Excel. All parsing happens in the browser — no upload.

## Develop
    npm install
    npm run dev

## Test
    npm test    # golden-master e2e runs only when samples/ PDFs are present

## Build
    npm run build   # static output in dist/

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for design & plan.
Patient sample files live in `samples/` and are git-ignored (PHI).
```

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `dist/` created, no type or build errors.

- [ ] **Step 3: Deploy to Vercel**

Use the `vercel:deploy` skill with argument `prod` (handles project link + auth).
Expected: a production URL is returned.

- [ ] **Step 4: Verify the live site**

Open the returned URL; confirm the page loads and a sample PDF produces a preview + download. (Use a sample locally; do not upload PHI to verify — the app runs client-side so local verification suffices.)

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-review notes (author)

- **Spec coverage:** multi-upload+reorder (T10), preview (T9), Excel fidelity incl. dropdowns/merges/Total (T6), parsing+grouping rules (T5/T7), colors (T3), sample types (T4), nearest-Wednesday date (T2), privacy/client-side (architecture), golden master (T8). ✓
- **Type consistency:** `RawRecord`/`RawColumn`/`OutputRow`/`TextItem`/`SampleCount` defined in T1 `types.ts`; `transform` returns `{rows,warnings}`; `parseRecordFromItems(items,fileName)`; `extractPdfItems(data,pdfjs)`; `buildWorkbook(rows)`/`workbookBlob(rows)`; `renderPreview(rows)`; `translateColor`→`{value,known}`; `parseSampleTotals`→`{samples,warnings}`. Consistent across tasks. ✓
- **Risk flags:** ExcelJS-in-browser may need the node polyfills (configured T1); pdf.js worker via `?url` (T10) and legacy build for Node tests (T8). If the golden master surfaces token-boundary differences, T7 is the place to adjust (note in T8).
