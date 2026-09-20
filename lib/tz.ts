// Client-safe time helpers for the timezone toggle. Schedules are stored and
// published as Asia/Shanghai wall-clock strings ("HH:MM", hours may exceed 23
// for past-midnight ends). "Local" means the viewer's browser zone.

export type TzMode = "shanghai" | "local";
export const TZ_STORAGE_KEY = "tenkyu:tz";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "HH:MM" → minutes from midnight; permissive on hours (0..47) for past-midnight ends. */
export function hhmmToMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 47 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Instant for `min` minutes after 00:00 Asia/Shanghai on `date` (YYYY-MM-DD). */
export function shanghaiInstant(date: string, min: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, min) - SHANGHAI_OFFSET_MS);
}

const localTime = () =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const localDate = () =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

export type LocalLabel = { text: string; dayShift: number };

/** Format a Shanghai wall-clock minute on `date` in the browser's zone. dayShift ≠ 0 → other calendar day locally. */
export function toLocalLabel(date: string, min: number): LocalLabel {
  const instant = shanghaiInstant(date, min);
  const text = localTime().format(instant);
  const ld = localDate().format(instant); // YYYY-MM-DD in local zone
  const dayShift = Math.round((Date.parse(`${ld}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  return { text, dayShift };
}

export function dayShiftSuffix(shift: number): string {
  if (shift > 0) return "(次日)";
  if (shift < 0) return "(前日)";
  return "";
}

export function localZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "本地";
  } catch {
    return "本地";
  }
}

/** Minutes offset of the viewer's zone relative to Asia/Shanghai at a given instant (local − Shanghai). */
export function localOffsetFromShanghaiMin(at: Date = new Date()): number {
  return -at.getTimezoneOffset() - 480;
}
