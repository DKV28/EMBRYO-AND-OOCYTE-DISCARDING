import { describe, it, expect } from 'vitest';
import { transform } from './transform';
import type { RawRecord } from './types';

const hoa: RawRecord = {
  fileName: 'HOA.pdf', wifeName: 'NGUYỄN THỊ KIM HOA', husbandName: 'PHẠM XUÂN LỘC',
  wifePID: '2510039262', husbandPID: '2510039264', orDate: new Date(Date.UTC(2025, 2, 4)),
  samples: [{ type: 'Embryo', count: 9 }],
  columns: [2, 2, 2, 3, 3, 3].map((c, i) => ({
    location: 'E19G9T', cassetteNo: c, cassetteColorVi: 'ĐỎ',
    tecNo: i + 2, tecColorVi: 'VÀNG', biopsy: '',
  })),
  warnings: [],
};

const anh: RawRecord = {
  fileName: 'ANH.pdf', wifeName: 'NGUYỄN THỊ NGUYỆT ÁNH', husbandName: 'PHẠM HOÀNG LAM',
  wifePID: '2410001993', husbandPID: '2410001994', orDate: new Date(Date.UTC(2025, 5, 9)),
  samples: [{ type: 'Embryo', count: 2 }],
  columns: [
    { location: 'E23G6T', cassetteNo: 1, cassetteColorVi: 'XANH LÁ', tecNo: 1, tecColorVi: 'VÀNG', biopsy: '25TAH158-E1' },
    { location: 'E25G1G', cassetteNo: 2, cassetteColorVi: 'CAM', tecNo: 2, tecColorVi: 'XANH LÁ', biopsy: '25TAH158-E2' },
  ],
  warnings: [],
};

const spermAn: RawRecord = {
  fileName: 'AN.pdf', form: '266', wifeName: '', husbandName: 'TRẦN VĂN AN',
  wifePID: '', husbandPID: '2410022517', orDate: null, freezeDate: new Date(Date.UTC(2025, 2, 17)),
  samples: [{ type: 'Sperm', count: 1 }], columns: [],
  sperm266: { location: 'TS4-G2D', containerColorVi: 'VÀNG', count: 1, origin: 'XUẤT TINH', note: '' },
  warnings: [],
};

const spermBank: RawRecord = {
  fileName: 'BANK.pdf', form: '266', wifeName: 'NGUYỄN ĐỖ THỊ MƯỜI', husbandName: '',
  wifePID: '21117279', husbandPID: '', orDate: null, freezeDate: new Date(Date.UTC(2025, 2, 17)),
  samples: [{ type: 'Sperm', count: 1 }], columns: [],
  sperm266: { location: 'TS2-G7-C12B', containerColorVi: 'CRYOTUBE', count: 1, origin: 'PESA', note: 'MÃ NHTT: 2414418' },
  warnings: [],
};

const DATE = new Date(Date.UTC(2026, 5, 10));

describe('transform', () => {
  it('Hoa: one location, distinct cassette count 2, 6 tec', () => {
    const { rows } = transform([hoa], DATE);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      no: 1, pid: 'M: 2510039264\nF: 2510039262', embryo: 9, oocyte: null, sperm: null,
      location: 'E19G9T', numCassettes: 2, cassetteColor: 'Red', numTec: 6, tecColor: 'Yellow',
      storageCompliance: '', cfCompliance: '', discardingProcedure: '', signaturesCompliance: '',
      isCaseStart: true, caseRowSpan: 1,
    });
    expect(rows[0].discardingDate).toEqual(DATE);
    expect(rows[0].orDate).toEqual(new Date(Date.UTC(2025, 2, 4)));
  });

  it('Ánh: two locations → two rows, patient fields only on first', () => {
    const { rows } = transform([anh], DATE);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ no: 1, location: 'E23G6T', numCassettes: 1, cassetteColor: 'Green', numTec: 1, tecColor: 'Yellow', isCaseStart: true, caseRowSpan: 2 });
    expect(rows[1]).toMatchObject({ no: null, pid: null, orDate: null, embryo: null, location: 'E25G1G', numCassettes: 1, cassetteColor: 'Orange', numTec: 1, tecColor: 'Green', isCaseStart: false, caseRowSpan: 2 });
  });

  it('267 rows mark the sperm-form-only columns N/A', () => {
    const { rows } = transform([hoa], DATE);
    expect(rows[0]).toMatchObject({
      freezeDate: 'N/A', numContainers: 'N/A', containerType: 'N/A', containerColor: 'N/A',
      origin: 'N/A', note: 'N/A',
    });
  });

  it('266 sperm (husband): single row, role-prefixed PID, freeze date, tec container', () => {
    const { rows, warnings } = transform([spermAn], DATE);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      no: 1, pid: 'M: 2410022517', orDate: 'N/A', sperm: 1, embryo: null, oocyte: null,
      location: 'TS4-G2D', numCassettes: 'N/A', cassetteColor: 'N/A', numTec: 'N/A', tecColor: 'N/A',
      numContainers: 1, containerType: 'Tec', containerColor: 'Yellow',
      origin: 'XUẤT TINH', note: '', isCaseStart: true, caseRowSpan: 1,
    });
    expect(rows[0].freezeDate).toEqual(new Date(Date.UTC(2025, 2, 17)));
    expect(warnings).toEqual([]);
  });

  it('266 sperm-bank (single woman): F-prefixed PID, CRYOTUBE container without color', () => {
    const { rows } = transform([spermBank], DATE);
    expect(rows[0]).toMatchObject({
      pid: 'F: 21117279', numContainers: 1, containerType: 'Cryotube', containerColor: 'N/A',
      origin: 'PESA', note: 'MÃ NHTT: 2414418',
    });
  });

  it('numbers mixed 267 and 266 records by list order', () => {
    const { rows } = transform([hoa, spermAn], DATE);
    expect(rows[0].no).toBe(1);
    expect(rows.find(r => r.location === 'TS4-G2D')!.no).toBe(2);
  });

  it('numbers records by list order', () => {
    const { rows } = transform([hoa, anh], DATE);
    expect(rows[0].no).toBe(1);
    expect(rows.find(r => r.location === 'E23G6T')!.no).toBe(2);
  });
});
