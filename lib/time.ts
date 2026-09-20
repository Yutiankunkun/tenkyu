// All schedule arithmetic is done in Asia/Shanghai (UTC+8, no DST). We shift the
// epoch by +8h and then use UTC getters, which avoids any timezone library.

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A Date whose UTC fields read as Asia/Shanghai wall-clock time. */
export function shanghaiNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + SHANGHAI_OFFSET_MS);
}

/** ISO weekday 1..7 (Mon..Sun) of a shifted date. */
export function isoWeekday(shifted: Date): number {
  const d = shifted.getUTCDay(); // 0 = Sun
  return d === 0 ? 7 : d;
}

export function toISODate(shifted: Date): string {
  return shifted.toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DD" into a shifted Date at 00:00 (UTC fields). Returns null if invalid. */
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || toISODate(d) !== s) return null;
  return d;
}

export function addDays(shifted: Date, days: number): Date {
  return new Date(shifted.getTime() + days * DAY_MS);
}

/** Monday 00:00 of the week containing `shifted`. */
export function mondayOf(shifted: Date): Date {
  const wd = isoWeekday(shifted);
  const midnight = new Date(`${toISODate(shifted)}T00:00:00Z`);
  return addDays(midnight, -(wd - 1));
}

/** Monday (YYYY-MM-DD) of the current Asia/Shanghai week. */
export function currentWeekStart(now: Date = new Date()): string {
  return toISODate(mondayOf(shanghaiNow(now)));
}

export function isMonday(isoDate: string): boolean {
  const d = parseISODate(isoDate);
  return !!d && isoWeekday(d) === 1;
}

/** Minutes from midnight → "HH:MM". Values ≥ 1440 render as 24:xx, 25:xx … (past midnight). */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minutes from midnight, or null if malformed. Accepts 00:00–23:59. */
export function hhmmToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** "2026-09-21" → "9/21" for compact headers. */
export function shortMD(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(m)}/${Number(d)}`;
}
