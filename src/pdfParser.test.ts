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

// Reproduce "Nhung" (2410008608): the cassette colour XANH DƯƠNG is too wide for the
// column, so it wraps onto two lines that sit just above and below the row label
// (real geometry: label y=553.8, XANH y=546.9, DƯƠNG y=560.7, row pitch ~28.7).
function nhungItems(): TextItem[] {
  const xs = [179, 245, 311, 377, 442, 508];
  const items: TextItem[] = [];
  items.push(...line(10, 'Họ tên vợ', [{ x: 179, s: 'NHUNG' }]));
  items.push(...line(38, 'PID', [{ x: 179, s: '2410008608' }]));
  items.push(...line(66, 'Họ tên chồng', [{ x: 179, s: 'SANG' }]));
  items.push(...line(94, 'PID', [{ x: 179, s: '2410008618' }]));
  items.push(...line(122, 'Ngày chọc hút', [{ x: 179, s: '04/06/2024' }]));
  items.push(...line(150, 'Vị trí cất', xs.map(x => ({ x, s: 'E20G4T' }))));
  items.push(...line(178, 'Stt cassette', [2, 3, 4, 5, 6, 7].map((c, i) => ({ x: xs[i], s: String(c) }))));
  items.push(...line(199, '', xs.map(x => ({ x, s: 'XANH' }))));      // wrapped value, above the label
  items.push(...line(206, 'Màu cassette', []));                       // label line carries no values
  items.push(...line(213, '', xs.map(x => ({ x, s: 'DƯƠNG' }))));     // wrapped value, below the label
  items.push(...line(234, 'Stt tec', [2, 3, 4, 5, 6, 7].map((c, i) => ({ x: xs[i], s: String(c) }))));
  items.push(...line(262, 'Màu tec', xs.map(x => ({ x, s: 'HỒNG' }))));
  items.push(...line(290, 'Tổng số mẫu hủy', [{ x: 179, s: '8' }, { x: 192, s: 'PHÔI/6' }, { x: 230, s: 'TEC' }]));
  return items;
}

// Reproduce a TA2.HSBA.266 sperm-destruction record (single key-value fields).
function spermItems(over: { color?: string; loc?: string; origin?: string; note?: string } = {}): TextItem[] {
  const items: TextItem[] = [];
  items.push(...line(5, 'TA2.HSBA.266.V2', []));
  items.push(...line(10, 'BIÊN BẢN', []));
  items.push(...line(15, 'Hủy tinh trùng trữ đông theo nguyện vọng của người bệnh tại Đơn vị Hỗ trợ sinh sản', []));
  items.push(...line(20, 'Họ tên chồng', [{ x: 250, s: 'TRẦN' }, { x: 290, s: 'VĂN' }, { x: 320, s: 'AN' }]));
  items.push(...line(30, 'Ngày tháng năm sinh', [{ x: 250, s: '01/02/1990' }]));
  items.push(...line(40, 'PID', [{ x: 250, s: '2410022517' }]));
  items.push(...line(50, 'Họ tên vợ(hoặc phụ nữ độc thân)', []));
  items.push(...line(60, 'Ngày tháng năm sinh', []));
  items.push(...line(70, 'PID', []));
  items.push(...line(80, 'Ngày trữ tinh trùng', [{ x: 250, s: '17/03/2025' }]));
  items.push(...line(90, 'Vị trí cất', [{ x: 250, s: over.loc ?? 'TS4-G2D' }]));
  items.push(...line(100, 'Loại mẫu hủy', [{ x: 250, s: over.origin ?? 'XUẤT TINH' }]));
  items.push(...line(110, 'Màu cassette/Tec', (over.color ?? 'VÀNG').split(' ').map((s, i) => ({ x: 250 + i * 30, s }))));
  items.push(...line(120, 'Số mẫu hủy', [{ x: 250, s: '01' }]));
  if (over.note) items.push(...line(130, 'Ghi chú', [{ x: 250, s: over.note }]));
  return items;
}

describe('parseRecordFromItems — TA2.HSBA.266 sperm form', () => {
  it('parses a husband sperm record: PID, freeze date, location, color, count, origin', () => {
    const r = parseRecordFromItems(spermItems(), 'SPERM.pdf');
    expect(r.form).toBe('266');
    expect(r.husbandPID).toBe('2410022517');
    expect(r.wifePID).toBe('');
    expect(r.freezeDate).toEqual(new Date(Date.UTC(2025, 2, 17)));
    expect(r.samples).toEqual([{ type: 'Sperm', count: 1 }]);
    expect(r.sperm266).toMatchObject({ location: 'TS4-G2D', containerColorVi: 'VÀNG', count: 1, origin: 'XUẤT TINH', note: '' });
    expect(r.warnings).toEqual([]);
  });

  it('parses a single-woman sperm-bank record with PID under the wife block', () => {
    const items = spermItems({ origin: 'NHTT', note: 'MÃ SỬ DỤNG NGÂN HÀNG TINH TRÙNG: 2414418' })
      // move the PID from the husband block (y=40) to the wife block (y=70)
      .map(it => (it.str === '2410022517' && it.y === 40 ? { ...it, y: 70 } : it));
    const r = parseRecordFromItems(items, 'SPERM2.pdf');
    expect(r.husbandPID).toBe('');
    expect(r.wifePID).toBe('2410022517');
    expect(r.sperm266!.note).toBe('MÃ SỬ DỤNG NGÂN HÀNG TINH TRÙNG: 2414418');
    // the "(hoặc phụ nữ độc thân)" part of the label must not leak into the name
    expect(r.wifeName).toBe('');
  });

  it('parses a CRYOTUBE record (container, not a color) with canister location', () => {
    const r = parseRecordFromItems(spermItems({ color: 'CRYOTUBE', loc: 'TS2-G7-C12B', origin: 'PESA' }), 'SPERM3.pdf');
    expect(r.sperm266).toMatchObject({ location: 'TS2-G7-C12B', containerColorVi: 'CRYOTUBE', origin: 'PESA' });
  });

  it('parses a multi-word color (XANH LÁ)', () => {
    const r = parseRecordFromItems(spermItems({ color: 'XANH LÁ' }), 'SPERM4.pdf');
    expect(r.sperm266!.containerColorVi).toBe('XANH LÁ');
  });
});

describe('parseRecordFromItems', () => {
  it('parses Hoa: PIDs, OR date, 9 embryo, 6 columns at one location', () => {
    const r = parseRecordFromItems(hoaItems(), 'HOA.pdf');
    expect(r.wifePID).toBe('2510039262');
    expect(r.husbandPID).toBe('2510039264');
    expect(r.orDate).toEqual(new Date(Date.UTC(2025, 2, 4)));
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

  it('parses Nhung: cassette colour wrapped onto lines above and below the row label', () => {
    const r = parseRecordFromItems(nhungItems(), 'NHUNG.pdf');
    expect(r.columns).toHaveLength(6);
    expect(r.columns.every(c => c.cassetteColorVi === 'XANH DƯƠNG')).toBe(true);
    expect(r.columns.every(c => c.tecColorVi === 'HỒNG')).toBe(true);
    expect(r.columns.map(c => c.cassetteNo)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('throws on a non-matching document', () => {
    const items: TextItem[] = [{ str: 'Some', x: 10, y: 10 }, { str: 'invoice', x: 40, y: 10 }];
    expect(() => parseRecordFromItems(items, 'x.pdf')).toThrow();
  });
});
