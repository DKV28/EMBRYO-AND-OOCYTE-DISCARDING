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

    // PID cell: prefix by role; couples get both lines, single patients one.
    const pidParts: string[] = [];
    if (rec.husbandPID) pidParts.push(`M: ${rec.husbandPID}`);
    if (rec.wifePID) pidParts.push(`F: ${rec.wifePID}`);
    const pid = pidParts.join('\n');

    if (rec.form === '266' && rec.sperm266) {
      const s = rec.sperm266;
      const isCryotube = s.containerColorVi.trim().toUpperCase() === 'CRYOTUBE';
      let containerColor = 'N/A';
      if (!isCryotube) {
        const c = translateColor(s.containerColorVi);
        if (!c.known) warnings.push(`[${tag}] unknown container color "${s.containerColorVi}"`);
        containerColor = c.value;
      }
      rows.push({
        no, discardingDate, pid,
        orDate: 'N/A', freezeDate: rec.freezeDate ?? null,
        embryo: null, oocyte: null, sperm: s.count,
        location: s.location,
        numCassettes: 'N/A', cassetteColor: 'N/A', numTec: 'N/A', tecColor: 'N/A',
        numContainers: s.count, containerType: isCryotube ? 'Cryotube' : 'Tec', containerColor,
        origin: s.origin, note: s.note,
        storageCompliance: '', cfCompliance: '', discardingProcedure: '', signaturesCompliance: '',
        isCaseStart: true, caseRowSpan: 1,
      });
      return;
    }

    // Group columns by location, preserving first-appearance order.
    const order: string[] = [];
    const groups = new Map<string, RawColumn[]>();
    for (const col of rec.columns) {
      if (!groups.has(col.location)) { groups.set(col.location, []); order.push(col.location); }
      groups.get(col.location)!.push(col);
    }
    if (order.length === 0) { warnings.push(`[${tag}] no storage locations found`); return; }

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
        freezeDate: start ? 'N/A' : null,
        embryo: start ? sampleCount('Embryo') : null,
        oocyte: start ? sampleCount('Oocyte') : null,
        sperm: start ? sampleCount('Sperm') : null,
        location: loc,
        numCassettes: new Set(cols.map(c => c.cassetteNo)).size,
        cassetteColor: cass.value,
        numTec: cols.length,
        tecColor: tec.value,
        numContainers: 'N/A', containerType: 'N/A', containerColor: 'N/A',
        origin: 'N/A', note: 'N/A',
        // Compliance is filled in by the auditor via the preview dropdowns, not pre-set.
        storageCompliance: '',
        cfCompliance: '',
        discardingProcedure: '',
        signaturesCompliance: '',
        isCaseStart: start,
        caseRowSpan: order.length,
      });
    });
  });

  return { rows, warnings };
}
