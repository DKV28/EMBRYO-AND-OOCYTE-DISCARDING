# Discarding Audit Builder — Design

- **Date:** 2026-06-08
- **Status:** Approved (pending spec review)
- **Author:** Pierre + Claude

## 1. Summary

A static, **client-side** web app that converts a batch of IVF embryo/oocyte/sperm
**destruction-record PDFs** (Tâm Anh Hospital form `TA2.HSBA.267`) into a single
downloadable **Excel audit** that faithfully clones the existing
`desired_output.xlsx` template. All parsing happens in the browser — patient data
never leaves the device. Deployed as a static site on Vercel.

## 2. Context & problem

Each Wednesday the IVF unit destroys frozen samples per patient request. Each
patient has a 2-page PDF record. Today, someone hand-copies fields from every PDF
into a "Monitoring_Discarding audit" spreadsheet. This is slow and error-prone.
The tool automates: **drop the PDFs → review → download the spreadsheet.**

The source PDFs contain PHI (patient & spouse names, PIDs, DOBs), so data handling
matters (see §4).

## 3. Goals / non-goals

**Goals**
- Bulk-ingest many PDFs at once (drop or pick); accumulate, reorder, remove.
- Parse each PDF into structured rows; show an on-page **preview table** mirroring
  the Excel before download.
- Generate an `.xlsx` that matches `desired_output.xlsx` in structure and styling,
  including in-cell **Yes/No/N/A dropdowns** on the Compliance columns.
- Run 100% in the browser; work offline; cost nothing to host.

**Non-goals (v1)**
- Editing parsed values in the preview (preview is read-only; Compliance is editable
  in the downloaded Excel via dropdowns).
- Supporting hospital forms other than `TA2.HSBA.267`.
- Any server, database, login, or persistence.

## 4. Privacy & data handling

- All PDF parsing and Excel generation run in-browser via JavaScript. **No upload.**
- No analytics, no network calls at runtime (deps are bundled, not CDN-loaded).
- Real sample PDFs / spreadsheet are git-ignored (`samples/`), never committed.
- The deployed static bundle contains only code, no patient data.

## 5. User experience / flow

```
┌─ Discarding date: [ 2026-06-10 ▾ ]  (defaults to nearest Wednesday)
│
├─ ╭───────────────────────────────────────────╮
│  │   Drop patient PDFs here, or click to pick │   ← accepts multiple
│  ╰───────────────────────────────────────────╯
│
├─ Files (drag to reorder = sets "No."):
│   1. ✓ Tâm — 1 location, 3 embryo            [x]
│   2. ✓ Hoa — 1 location, 9 embryo            [x]
│   3. ✓ Ánh — 2 locations, 2 embryo           [x]
│   4. ✗ scan.pdf — not a TA2.HSBA.267 form    [x]
│
├─ Preview (read-only, mirrors the Excel):
│   [ rendered HTML table of OutputRows ]
│
└─ [ Download Excel ]   → "Monitoring_Discarding audit 2026-06-10.xlsx"
```

- Multiple selection via `<input type="file" multiple accept="application/pdf">`
  and drag-drop. Files accumulate; duplicates (same name) are ignored with a notice.
- Each file shows status: ✓ parsed (name + #locations + sample summary), ⚠ warning,
  ✗ error (reason). Errored files are excluded but don't block the others.
- **Download** is enabled only when ≥1 file parsed successfully.
- Discarding date defaults to the Wednesday nearest today; user can change it.

## 6. Architecture & modules

Vite + vanilla **TypeScript**, no UI framework. Each module is independently testable.

| Module | Responsibility | Depends on |
|---|---|---|
| `src/pdfParser.ts` | pdf.js → words+coordinates → `RawRecord` | `pdfjs-dist` |
| `src/colors.ts` | Vietnamese→English color map; unknown→passthrough+warn | — |
| `src/transform.ts` | `RawRecord[]` → `OutputRow[]` (pure function) | `colors.ts` |
| `src/excelWriter.ts` | `OutputRow[]` → ExcelJS workbook → `Blob` | `exceljs` |
| `src/dates.ts` | parse `DD/MM/YYYY`; nearest-Wednesday default | — |
| `src/main.ts` | UI glue: files, reorder, statuses, preview, download | all above |
| `index.html`, `src/style.css` | markup & styling | — |

**Data flow:** `File → pdfParser → RawRecord → validate → transform → OutputRow[] →
{ preview table | excelWriter → Blob → download }`. The same `OutputRow[]` drives
both the preview and the workbook, guaranteeing WYSIWYG.

## 7. Data model

```ts
type SampleType = 'Embryo' | 'Oocyte' | 'Sperm';
interface SampleCount { type: SampleType; count: number; }

interface RawColumn {           // one table column in the PDF (= one "tec" entry)
  location: string;             // Vị trí cất, e.g. "E6G1T"
  cassetteNo: number;           // Stt cassette
  cassetteColorVi: string;      // Màu cassette (Vietnamese)
  tecNo: number;                // Stt tec
  tecColorVi: string;           // Màu tec (Vietnamese)
  biopsy?: string;              // Mã sinh thiết (nếu có)
}

interface RawRecord {
  fileName: string;
  wifePID: string;              // PID under "Họ tên vợ"
  husbandPID: string;           // PID under "Họ tên chồng"
  orDate: Date;                 // Ngày chọc hút
  samples: SampleCount[];       // parsed from "Tổng số mẫu hủy"
  columns: RawColumn[];
  warnings: string[];
}

interface OutputRow {
  // patient-level fields — present only on a case's first row:
  no?: number;
  discardingDate?: Date;
  pid?: string;                 // "M: <husband>\nF: <wife>"
  orDate?: Date;
  embryo?: number; oocyte?: number; sperm?: number;
  // per-location fields — on every row:
  location: string;
  numCassettes: number; cassetteColor: string;
  numTec: number; tecColor: string;
  storageCompliance: string;    // default "N/A"
  cfCompliance: string;         // default "Yes"
  discardingProcedure: string;  // default "Yes"
  // layout:
  isCaseStart: boolean;
  caseRowSpan: number;          // # location rows in this case (for vertical merge)
}
```

## 8. PDF parsing approach

Per PDF, page 1 only (page 2 is boilerplate signatures).

1. `getTextContent()` yields items with `str` and `transform` (x = `transform[4]`,
   y = `transform[5]`). Group items into **lines** by y (tolerance ~3pt), sort each
   line by x.
2. **Single-value fields** are label→value on one line, parsed by section order:
   `Họ tên vợ`, `Ngày sinh`, `PID` (wife), `Họ tên chồng`, `Ngày sinh`, `PID`
   (husband), `Ngày chọc hút`, … The first `PID` after the wife block is `wifePID`,
   the first after the husband block is `husbandPID`.
3. `Tổng số mẫu hủy` value (e.g. `"3 PHÔI/3 TEC"`): split on `/`; each segment
   `"<n> <TYPE>"` where TYPE ∈ {PHÔI, NOÃN, TINH TRÙNG} → a `SampleCount`. The
   `… TEC` segment is the device total and is **ignored** for sample columns
   (tec counts are derived from the table, §9).
4. **Table block** (rows `Vị trí cất`, `Stt cassette`, `Màu cassette`, `Stt tec`,
   `Màu tec`, `Mã sinh thiết`): take value tokens to the right of the label area,
   **cluster by x** into column bins (gap/tolerance based; verified column centers
   are well separated, e.g. Hoa's six at ~179/245/311/377/442/508). Merge multiple
   tokens that fall in the same bin+row (e.g. `XANH` + `LÁ` → `"XANH LÁ"`).
   Each column bin yields one `RawColumn`.
5. **Form validation:** require anchor strings (`Hủy phôi trữ đông`, `Vị trí cất`,
   `Tổng số mẫu hủy`). Missing → file rejected as "not a TA2.HSBA.267 form".

> pdf.js exposes the same word+coordinate data proven to work during design
> (the Python/pymupdf spike reproduced every expected row), so this is low-risk.

## 9. Transformation rules (validated against all 3 samples)

For record *i* (1-based in list order):

| Output column | Rule |
|---|---|
| **No.** | `i` (list order) — first row of the case only |
| **Discarding date** | the user's chosen date — first row only |
| **PID** | `"M: " + husbandPID + "\n" + "F: " + wifePID` — first row only |
| **OR Date** | `orDate` (Ngày chọc hút) — first row only |
| **Embryo / Oocyte / Sperm** | from `samples` by type — first row only |
| **Location** | each **distinct** `Vị trí cất` (first-appearance order) → one row |
| **Number of cassettes** | per location: count of **distinct** `cassetteNo` |
| **Color of cassettes** | per location: `translate(cassetteColorVi)` (uniform; mixed → warn, use first) |
| **Number of tec** | per location: number of columns (= distinct `tecNo`) |
| **Color of tec** | per location: `translate(tecColorVi)` (uniform; mixed → warn) |
| **Storage / CF / Discarding compliance** | defaults `N/A` / `Yes` / `Yes` |

`caseRowSpan` = number of distinct locations. Patient-level fields appear on the
first row; the remaining location rows carry only Location…Compliance.

**Validated examples**
- *Tâm*: one location → 1 row; cassettes 3, tec 3, Red/Green; 3 embryo.
- *Hoa*: one location; cassetteNo `{2,2,2,3,3,3}` → **2 cassettes**, 6 columns →
  **6 tec**, Red/Yellow; 9 embryo.
- *Ánh*: two locations → **2 rows**; `E23G6T` (1 cass Green / 1 tec Yellow),
  `E25G1G` (1 cass Orange / 1 tec Green); 2 embryo on the first row; A–G merged.

### Color map (`colors.ts`)

Confirmed: `ĐỎ→Red`, `XANH LÁ→Green`, `VÀNG→Yellow`, `CAM→Orange`.
Inferred (present in output, not in the 3 samples): `TRẮNG→White`, `HỒNG→Pink`,
`KEM→Cream`, `XANH DƯƠNG/XANH BIỂN→Blue`. Matching is case-insensitive and
diacritic-tolerant. **Unknown term → output the raw Vietnamese value + a warning**
(never silently wrong; trivially extensible).

### Sample-type map

`PHÔI→Embryo` (confirmed), `NOÃN→Oocyte` (inferred), `TINH TRÙNG→Sperm` (inferred).
Unknown term → warning, count dropped into a fallback (Embryo) is **not** assumed;
instead the row is flagged for manual check.

## 10. Excel output specification (faithful clone)

- **Sheet name:** `Trang tính1`.
- **Header** (rows 1–2), bold, centered, wrapped, Calibri 11:
  - Merges: `A1:A2 B1:B2 C1:C2 D1:D2` (No./Discarding date/PID/OR Date),
    `E1:G1` (Sample) with `E2/F2/G2` = Embryo/Oocyte/Sperm,
    `H1:H2 I1:I2 J1:J2 K1:K2 L1:L2`, `M1:O1` (Compliance) with `M2/N2/O2` =
    Storage Compliance / CF Compliance / Discarding Procedure (newline in label).
  - Fills: cream `FFF2CC` for A,B,C,D,H,I,J,K,L; pink `EAD1DC` for the Sample
    group (E,F,G) and Compliance group (M,N,O).
- **Data** from row 3, Calibri 11, wrap, vertical-center; A/D/E/F/G/H…O centered,
  B/C left.
  - `B` (Discarding date) & `D` (OR Date) number format `dd/mm/yyyy`.
  - `C` (PID) wrapped, contains the literal `\n` between the M and F lines.
  - For a multi-location case (`caseRowSpan > 1`): vertically **merge** columns
    A–G across the case's rows (template merged A–E; we extend through G so a
    multi-location oocyte/sperm value also merges cleanly). H–O are per-location.
  - **Compliance dropdowns:** every `M:O` data cell gets ExcelJS data-validation
    `{ type:'list', allowBlank:true, formulae:['"Yes,No,N/A"'] }`, pre-filled with
    the defaults.
- **Total row** (after last data row): `D="Total"` (bold), `E=SUM(E3:E<last>)`
  (bold); add `F`/`G` sums only if those columns contain data.
- **No cell borders** (matches the Google-Sheets-exported template).
- **Column widths:** set `M≈15` (as in template) plus readable widths for
  B, C, D, H, I, J, K, L (minor, deliberate readability improvement over the
  all-default template).
- **Download filename:** `Monitoring_Discarding audit <YYYY-MM-DD>.xlsx`.

## 11. Error handling & validation

| Condition | Behavior |
|---|---|
| Not a TA2.HSBA.267 form (missing anchors) | ✗ reject file, reason shown, others proceed |
| Unparseable date / missing PID / empty table | ⚠ warn with specifics; emit what parsed |
| Unknown color term | ⚠ warn; output raw Vietnamese value |
| Unknown sample term | ⚠ warn; flag row for manual check |
| Mixed colors within one location | ⚠ warn; use first color |
| Duplicate file name added | ignored with a notice |
| No successfully-parsed files | Download disabled |

## 12. Testing strategy (Vitest)

- **`transform.ts` unit tests** (pure): the Hoa distinct-cassette grouping and the
  Ánh two-location case; numbering; sample routing; default compliance.
- **`colors.ts` / `dates.ts`** unit tests, incl. nearest-Wednesday and `DD/MM/YYYY`.
- **End-to-end golden master:** run the real `pdfParser` on the 3 sample PDFs
  (from `samples/`, run locally) and assert the resulting `OutputRow[]` equals the
  known values for cases 1–3 (ground truth = `desired_output.xlsx` cases 2–4,
  renumbered). Skipped automatically when fixtures are absent (e.g. CI).
- **`excelWriter.ts`:** read back the generated workbook and assert merges,
  data-validation presence on M:O, number formats, fills, and the Total formula.

## 13. Deployment

- `npm run build` → static `dist/`. Vercel auto-detects Vite (no config needed).
- No env vars, no functions, no data egress.

## 14. Known inference gaps / future work

- **Oocyte/sperm**: terms `NOÃN` / `TINH TRÙNG` and the `Tổng số mẫu hủy` wording
  for non-embryo records are inferred (all 3 samples are embryos). Built generically;
  a single real sample later confirms the exact wording.
- **Color palette**: White/Pink/Cream/Blue Vietnamese terms inferred; unknowns are
  surfaced as warnings so nothing is silently mistranslated.
- **Future (optional):** edit Compliance/date in the preview; anonymized CI fixtures;
  multi-hospital form support.

## 15. Tech stack & dependencies

- Build: **Vite**, **TypeScript**.
- Runtime: **pdfjs-dist** (PDF parsing), **exceljs** (xlsx writing) — both bundled.
- Test: **Vitest**.
- Host: **Vercel** (static).
