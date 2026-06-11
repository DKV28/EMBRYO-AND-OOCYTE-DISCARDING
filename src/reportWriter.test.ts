// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import { buildReportDoc, countCases, DEFAULT_AUDITOR } from './reportWriter';
import type { OutputRow } from './types';

function baseRow(over: Partial<OutputRow>): OutputRow {
  return {
    caseId: 'C', no: null, discardingDate: null, pid: null, orDate: null, freezeDate: null,
    embryo: null, oocyte: null, sperm: null,
    location: 'X', numCassettes: 1, cassetteColor: 'Red', numTec: 1, tecColor: 'Green',
    numContainers: 'N/A', containerType: 'N/A', containerColor: 'N/A', origin: 'N/A', note: 'N/A',
    storageCompliance: '', cfCompliance: '', discardingProcedure: '', signaturesCompliance: '',
    isCaseStart: true, caseRowSpan: 1, ...over,
  };
}

const rows: OutputRow[] = [
  baseRow({ no: 1, pid: 'M: 1\nF: 2', orDate: new Date(Date.UTC(2025, 2, 4)), embryo: 9, location: 'E19G9T' }),
  baseRow({ no: 2, orDate: new Date(Date.UTC(2025, 5, 9)), embryo: 2, location: 'E23G6T', caseRowSpan: 2 }),
  baseRow({ location: 'E25G1G', isCaseStart: false, caseRowSpan: 2 }),
  baseRow({ no: 3, pid: 'M: 2410022517', orDate: 'N/A', sperm: 1, location: 'TS4-G2D',
    numCassettes: 'N/A', cassetteColor: 'N/A', numTec: 'N/A', tecColor: 'N/A' }),
];

describe('countCases', () => {
  it('counts embryo vs sperm cases (continuation rows ignored)', () => {
    expect(countCases(rows)).toEqual({ nEmbryo: 2, nSperm: 1 });
  });
});

describe('buildReportDoc', () => {
  it('packs into a non-trivial .docx (zip) buffer', async () => {
    const doc = buildReportDoc(rows, { auditor: DEFAULT_AUDITOR, auditDate: new Date(Date.UTC(2026, 5, 10)) });
    const buf = await Packer.toBuffer(doc);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K' — zip signature
  });
});
