import type { RawRecord } from './types';

// A saved working session: parsed records + audit metadata + the compliance the
// auditor has entered so far (keyed so it survives re-transform and reload).
// PDF binaries are never stored — only the parsed records.
export interface ComplianceValues {
  storage: string;
  cf: string;
  discarding: string;
  signatures: string;
}
export interface SessionState {
  discardingDate: string | null;            // YYYY-MM-DD (from <input type=date>)
  auditor: string;
  records: RawRecord[];
  compliance: Record<string, ComplianceValues>;  // rowKey → values
}

const SCHEMA_VERSION = 1;

// Dates inside RawRecord are UTC-midnight; persist as ISO and revive losslessly.
type SerializedRecord = Omit<RawRecord, 'orDate' | 'freezeDate'> & {
  orDate: string | null;
  freezeDate?: string | null;
};

function serializeRecord(r: RawRecord): SerializedRecord {
  return { ...r, orDate: r.orDate ? r.orDate.toISOString() : null,
    freezeDate: r.freezeDate ? r.freezeDate.toISOString() : null };
}
function reviveRecord(r: SerializedRecord): RawRecord {
  return { ...r, orDate: r.orDate ? new Date(r.orDate) : null,
    freezeDate: r.freezeDate ? new Date(r.freezeDate) : null };
}

export function serializeSession(state: SessionState): string {
  return JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    discardingDate: state.discardingDate,
    auditor: state.auditor,
    records: state.records.map(serializeRecord),
    compliance: state.compliance,
  });
}

export function deserializeSession(json: string): SessionState {
  const o = JSON.parse(json);
  if (o.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported session schema version: ${o.schemaVersion}`);
  }
  return {
    discardingDate: o.discardingDate ?? null,
    auditor: o.auditor ?? '',
    records: (o.records ?? []).map(reviveRecord),
    compliance: o.compliance ?? {},
  };
}
