import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import type {
  PublishedDay,
  PublishedSchedule,
  PublishedStreamer,
  PublishedWeek,
  Slot,
  SlotTemplateRow,
  StreamerRow,
  WeekOverrideRow,
} from "@/lib/types";
import { addDays, minutesToHHMM, parseISODate, toISODate } from "@/lib/time";

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}$/;
export const PUBLISHED_WEEKS = 4;

export function scheduleTag(handle: string) {
  return `schedule:${handle}`;
}
export const STREAMERS_TAG = "streamers";

type PublicStreamerCols = Pick<
  StreamerRow,
  "id" | "handle" | "display_name" | "avatar_url" | "theme_color" | "intro" | "bili_room_id"
>;

function toPublishedStreamer(s: PublicStreamerCols): PublishedStreamer {
  return {
    handle: s.handle,
    display_name: s.display_name,
    avatar_url: s.avatar_url,
    theme_color: s.theme_color,
    intro: s.intro,
    bili_room_url: s.bili_room_id ? `https://live.bilibili.com/${s.bili_room_id}` : null,
  };
}

/**
 * Pure: merge template + overrides into published weeks starting at `fromWeekStart`.
 * Exported so the editor can render "effective" days with the same rules.
 */
export function buildWeeks(
  fromWeekStart: string,
  weeks: number,
  template: Pick<SlotTemplateRow, "weekday" | "start_min" | "end_min" | "type" | "note">[],
  overrides: Pick<WeekOverrideRow, "week_start" | "weekday" | "mode" | "slots">[],
): PublishedWeek[] {
  const from = parseISODate(fromWeekStart);
  if (!from) throw new Error(`bad week start ${fromWeekStart}`);

  const byWeekday = new Map<number, Slot[]>();
  for (const t of template) {
    const list = byWeekday.get(t.weekday) ?? [];
    list.push({ start_min: t.start_min, end_min: t.end_min, type: t.type, note: t.note });
    byWeekday.set(t.weekday, list);
  }
  const ovKey = (ws: string, wd: number) => `${ws}#${wd}`;
  const ovMap = new Map<string, Pick<WeekOverrideRow, "mode" | "slots">>();
  for (const o of overrides) ovMap.set(ovKey(o.week_start, o.weekday), o);

  const sortSlots = (s: Slot[]) => [...s].sort((a, b) => a.start_min - b.start_min);
  const out: PublishedWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(from, 7 * w);
    const ws = toISODate(weekStart);
    const days: PublishedDay[] = [];
    for (let wd = 1; wd <= 7; wd++) {
      const ov = ovMap.get(ovKey(ws, wd));
      let slots: Slot[];
      let overridden = false;
      if (ov) {
        overridden = true;
        slots = ov.mode === "off" ? [] : sortSlots(ov.slots ?? []);
      } else {
        slots = sortSlots(byWeekday.get(wd) ?? []);
      }
      days.push({
        weekday: wd,
        date: toISODate(addDays(weekStart, wd - 1)),
        off: slots.length === 0,
        overridden,
        slots: slots.map((s) => ({
          start: minutesToHHMM(s.start_min),
          end: minutesToHHMM(s.end_min),
          type: s.type,
          note: s.note,
        })),
      });
    }
    out.push({ week_start: ws, days });
  }
  return out;
}

/**
 * Cached public read. Key = (handle, fromWeekStart): a new Monday is a new cache
 * entry, so the rolling window advances without an explicit invalidation. Saves
 * call updateTag(scheduleTag(handle)).
 */
export async function getPublishedSchedule(
  handle: string,
  fromWeekStart: string,
): Promise<PublishedSchedule | null> {
  "use cache";
  cacheTag(scheduleTag(handle));
  cacheLife("max");

  if (!HANDLE_RE.test(handle) || !parseISODate(fromWeekStart)) return null;
  const sb = createAnonClient();

  const { data: s, error: sErr } = await sb
    .from("streamer")
    .select("id, handle, display_name, avatar_url, theme_color, intro, bili_room_id")
    .eq("handle", handle)
    .maybeSingle<PublicStreamerCols>();
  if (sErr) throw sErr;
  if (!s) return null; // unknown, invited or hidden (RLS hides non-active rows)

  const [{ data: template, error: tErr }, { data: overrides, error: oErr }] = await Promise.all([
    sb
      .from("slot_template")
      .select("weekday, start_min, end_min, type, note")
      .eq("streamer_id", s.id)
      .returns<Pick<SlotTemplateRow, "weekday" | "start_min" | "end_min" | "type" | "note">[]>(),
    sb
      .from("week_override")
      .select("week_start, weekday, mode, slots")
      .eq("streamer_id", s.id)
      .gte("week_start", fromWeekStart)
      .returns<Pick<WeekOverrideRow, "week_start" | "weekday" | "mode" | "slots">[]>(),
  ]);
  if (tErr) throw tErr;
  if (oErr) throw oErr;

  return {
    ...toPublishedStreamer(s),
    generated_at: new Date().toISOString(),
    timezone: "Asia/Shanghai",
    weeks: buildWeeks(fromWeekStart, PUBLISHED_WEEKS, template ?? [], overrides ?? []),
  };
}

/** Cached list of active streamers for the home page and pickers. */
export async function getActiveStreamers(): Promise<PublishedStreamer[]> {
  "use cache";
  cacheTag(STREAMERS_TAG);
  cacheLife("max");

  const sb = createAnonClient();
  const { data, error } = await sb
    .from("streamer")
    .select("id, handle, display_name, avatar_url, theme_color, intro, bili_room_id")
    .order("display_name")
    .returns<PublicStreamerCols[]>();
  if (error) throw error;
  return (data ?? []).map(toPublishedStreamer);
}
