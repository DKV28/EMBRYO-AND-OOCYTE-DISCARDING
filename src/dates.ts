// Every calendar date in this app is a UTC-midnight Date. Both external
// interfaces already speak UTC — <input type="date">.valueAsDate returns UTC
// midnight and ExcelJS converts Dates to serials with pure UTC math — so a
// local-midnight Date would land its serial 7h before the day boundary on
// UTC+7 machines and Excel would display the previous day.

export function parseVnDate(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const day = +m[1], month = +m[2], year = +m[3];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

export function nearestWednesday(from: Date): Date {
  // Anchor on the caller's local calendar day ("today" for the default input),
  // then work in UTC like every other calendar date here.
  const base = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  let best = base, bestDist = Infinity;
  for (let delta = -6; delta <= 6; delta++) {
    const c = new Date(base); c.setUTCDate(base.getUTCDate() + delta);
    if (c.getUTCDay() === 3) {              // Wednesday
      const dist = Math.abs(delta);
      if (dist < bestDist || (dist === bestDist && delta > 0)) { best = c; bestDist = dist; }
    }
  }
  return best;
}

const pad = (n: number) => String(n).padStart(2, '0');
export function formatYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function formatDmy(d: Date): string {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
