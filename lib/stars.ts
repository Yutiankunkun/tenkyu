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

export type WatchData = {
  uid: number;
  room_id: number;
  uname: string;
  face: string;
  fans: number | null;
  level: number | null;
  live: { title: string; cover: string; online: number; area: string; started_at: string | null; seen_at: string } | null;
  handle: string | null;
  now: number;
};

/** Everything the watch page needs for one room: streamer facts + live state (if live) + claimed handle. */
export async function getWatch(roomId: number): Promise<WatchData | null> {
  const sb = createAnonClient();
  const { data: live } = await sb
    .from("live_now")
    .select("uid, room_id, title, cover, online, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level, deleted_at)")
    .eq("room_id", roomId)
    .maybeSingle<StarRow & { bili_streamer: StarRow["bili_streamer"] & { deleted_at: string | null } }>();

  let uid: number;
  let base: { uname: string; face: string; fans: number | null; level: number | null };
  if (live && !live.bili_streamer.deleted_at) {
    uid = live.uid;
    base = live.bili_streamer;
  } else {
    const { data: s } = await sb
      .from("bili_streamer")
      .select("uid, uname, face, fans, level, deleted_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .maybeSingle<{ uid: number; uname: string; face: string; fans: number | null; level: number | null }>();
    if (s) {
      uid = s.uid;
      base = s;
    } else {
      // Claimed streamer the collector has never seen live: build the page from her own profile.
      const { data: c } = await sb
        .from("streamer")
        .select("bili_uid, display_name, avatar_url")
        .eq("bili_room_id", roomId)
        .eq("status", "active")
        .not("bili_uid", "is", null)
        .maybeSingle<{ bili_uid: number; display_name: string; avatar_url: string }>();
      if (!c) return null;
      uid = c.bili_uid;
      base = { uname: c.display_name, face: c.avatar_url, fans: null, level: null };
    }
  }
  const { data: claimed } = await sb.from("streamer").select("handle").eq("bili_uid", uid).eq("status", "active").maybeSingle<{ handle: string }>();
  const fresh = live && Date.parse(live.seen_at) > Date.now() - STARS_STALE_MIN * 60 * 1000;
  return {
    uid,
    room_id: roomId,
    uname: base.uname,
    face: base.face,
    fans: base.fans,
    level: base.level,
    live: fresh ? { title: live.title, cover: live.cover, online: live.online, area: live.area, started_at: live.started_at, seen_at: live.seen_at } : null,
    handle: claimed?.handle ?? null,
    now: Date.now(),
  };
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
