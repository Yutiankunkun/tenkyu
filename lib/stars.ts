import { createAnonClient } from "@/lib/supabase/anon";

// 观星台 read model. Gate = account level >= 3, account not deleted, seen in the
// last STALE_MIN minutes. Fans band and area are display filters.

export const STARS_STALE_MIN = 20;
export const LEVEL_GATE = 3;
export type Band = "new" | "small" | "all";
export const BAND_LIMIT: Record<Band, number | null> = { new: 1000, small: 10000, all: null };

export type StarRow = {
  uid: number;
  room_id: number;
  title: string;
  cover: string;
  online: number;
  area: string;
  started_at: string | null;
  seen_at: string;
  bili_streamer: { uname: string; face: string; fans: number | null; level: number | null };
};

export type ClaimedMap = Map<number, string>; // bili_uid → handle

export async function getStars(
  band: Band,
  area: string | null,
): Promise<{ rows: StarRow[]; areas: string[]; updatedAt: string | null; now: number }> {
  const sb = createAnonClient();
  const since = new Date(Date.now() - STARS_STALE_MIN * 60 * 1000).toISOString();
  let q = sb
    .from("live_now")
    .select("uid, room_id, title, cover, online, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level)")
    .gte("seen_at", since)
    .gte("bili_streamer.level", LEVEL_GATE)
    .is("bili_streamer.deleted_at", null)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(400);
  const limit = BAND_LIMIT[band];
  if (limit !== null) q = q.lt("bili_streamer.fans", limit);
  const { data, error } = await q.returns<StarRow[]>();
  if (error) throw error;
  const all = data ?? [];
  const areas = [...new Set(all.map((r) => r.area).filter(Boolean))].sort();
  const rows = area ? all.filter((r) => r.area === area) : all;
  const updatedAt = all.length ? all.map((r) => r.seen_at).sort().at(-1)! : null;
  return { rows, areas, updatedAt, now: Date.now() };
}

/** Active onboarded streamers keyed by Bilibili uid, for the 已入驻 badge. */
export async function getClaimed(): Promise<ClaimedMap> {
  const sb = createAnonClient();
  const { data } = await sb.from("streamer").select("handle, bili_uid").not("bili_uid", "is", null).returns<{ handle: string; bili_uid: number }[]>();
  return new Map((data ?? []).map((s) => [s.bili_uid, s.handle]));
}

export function formatFans(n: number | null): string {
  if (n === null) return "";
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")} 万粉`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k 粉`;
  return `${n} 粉`;
}

export function minutesLive(startedAt: string | null, now: number): number | null {
  if (!startedAt) return null;
  return Math.max(0, Math.round((now - Date.parse(startedAt)) / 60000));
}
