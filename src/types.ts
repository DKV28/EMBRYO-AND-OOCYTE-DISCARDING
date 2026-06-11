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

// TA2.HSBA.266: sperm destruction at the patient's request (single key-value form).
export interface Sperm266 {
  location: string;
  containerColorVi: string;  // single combined "Màu cassette/Tec"; may be 'CRYOTUBE'
  count: number;             // Số mẫu hủy
  origin: string;            // Loại mẫu hủy: NHTT / XUẤT TINH / PESA …
  note: string;              // Ghi chú
}

export interface RawRecord {
  fileName: string;
  form?: '267' | '266';      // default '267' (embryo destruction form)
  wifeName: string;
  husbandName: string;
  wifePID: string;
  husbandPID: string;
  orDate: Date | null;
  freezeDate?: Date | null;  // 266 only: Ngày trữ tinh trùng
  samples: SampleCount[];
  columns: RawColumn[];
  sperm266?: Sperm266 | null;
  warnings: string[];
}

// 'N/A' marks a column the source form does not have (one column = one info).
// null marks a merged continuation cell (multi-location cases).
export interface OutputRow {
  no: number | null;
  discardingDate: Date | null;
  pid: string | null;
  orDate: Date | 'N/A' | null;
  freezeDate: Date | 'N/A' | null;
  embryo: number | null;
  oocyte: number | null;
  sperm: number | null;
  location: string;
  numCassettes: number | 'N/A';
  cassetteColor: string;
  numTec: number | 'N/A';
  tecColor: string;
  numContainers: number | 'N/A';
  containerType: string;
  containerColor: string;
  origin: string;   // Loại mẫu hủy (266 only)
  note: string;     // Ghi chú (266 only)
  storageCompliance: string;
  cfCompliance: string;
  discardingProcedure: string;
  isCaseStart: boolean;
  caseRowSpan: number;
}

export interface TextItem { str: string; x: number; y: number; }
