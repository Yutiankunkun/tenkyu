import { createAnonClient } from "@/lib/supabase/anon";

// 观星台 read model. Gate = account level >= 3, account not deleted, seen in the
// last STALE_MIN minutes. Band / area / tag / search / sort are display filters,
// applied in memory (a few thousand rows at most).

export const STARS_STALE_MIN = 20;
export const LEVEL_GATE = 3;
export type Band = "new" | "small" | "all";
export const BAND_LIMIT: Record<Band, number | null> = { new: 1000, small: 10000, all: null };
export type Sort = "new" | "hot" | "small";
export const SORT_LABEL: Record<Sort, string> = { new: "刚开播", hot: "人气高", small: "粉丝少" };

export type StarRow = {
  uid: number;
  room_id: number;
  title: string;
  cover: string;
  keyframe: string;
  tags: string[];
  online: number;
  area: string;
  started_at: string | null;
  seen_at: string;
  bili_streamer: { uname: string; face: string; fans: number | null; level: number | null };
};

export type ClaimedMap = Map<number, string>; // bili_uid → handle

export type StarsQuery = { band: Band; area: string | null; tag: string | null; q: string | null; sort: Sort };

export type StarsResult = {
  rows: StarRow[];
  areas: string[];
  topTags: string[];
  updatedAt: string | null;
  now: number;
};

const norm = (s: string) => s.toLowerCase();

export async function getStars(query: StarsQuery): Promise<StarsResult> {
  const sb = createAnonClient();
  const since = new Date(Date.now() - STARS_STALE_MIN * 60 * 1000).toISOString();
  let q = sb
    .from("live_now")
    .select("uid, room_id, title, cover, keyframe, tags, online, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level)")
    .gte("seen_at", since)
    .gte("bili_streamer.level", LEVEL_GATE)
    .is("bili_streamer.deleted_at", null)
    .limit(3000);
  const limit = BAND_LIMIT[query.band];
  if (limit !== null) q = q.lt("bili_streamer.fans", limit);
  const { data, error } = await q.returns<StarRow[]>();
  if (error) throw error;
  const all = (data ?? []).map((r) => ({ ...r, tags: r.tags ?? [], keyframe: r.keyframe ?? "" }));

  const areas = [...new Set(all.map((r) => r.area).filter(Boolean))].sort();
  const tagCount = new Map<string, number>();
  for (const r of all) for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const topTags = [...tagCount.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .slice(0, 18)
    .map(([t]) => t);

  let rows = all;
  if (query.area) rows = rows.filter((r) => r.area === query.area);
  if (query.tag) rows = rows.filter((r) => r.tags.includes(query.tag!));
  if (query.q) {
    const needle = norm(query.q);
    rows = rows.filter(
      (r) => norm(r.bili_streamer.uname).includes(needle) || norm(r.title).includes(needle) || r.tags.some((t) => norm(t).includes(needle)),
    );
  }
  const byStart = (a: StarRow, b: StarRow) => (b.started_at ?? "").localeCompare(a.started_at ?? "");
  if (query.sort === "hot") rows = [...rows].sort((a, b) => b.online - a.online || byStart(a, b));
  else if (query.sort === "small") rows = [...rows].sort((a, b) => (a.bili_streamer.fans ?? 1e9) - (b.bili_streamer.fans ?? 1e9) || byStart(a, b));
  else rows = [...rows].sort(byStart);

  const updatedAt = all.length ? all.map((r) => r.seen_at).sort().at(-1)! : null;
  return { rows, areas, topTags, updatedAt, now: Date.now() };
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
  live: {
    title: string;
    cover: string;
    keyframe: string;
    tags: string[];
    online: number;
    area: string;
    started_at: string | null;
    seen_at: string;
  } | null;
  handle: string | null;
  now: number;
};

/** Everything the watch page needs for one room: streamer facts + live state (if live) + claimed handle. */
export async function getWatch(roomId: number): Promise<WatchData | null> {
  const sb = createAnonClient();
  const { data: live } = await sb
    .from("live_now")
    .select("uid, room_id, title, cover, keyframe, tags, online, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level, deleted_at)")
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
    live: fresh
      ? {
          title: live.title,
          cover: live.cover,
          keyframe: live.keyframe ?? "",
          tags: live.tags ?? [],
          online: live.online,
          area: live.area,
          started_at: live.started_at,
          seen_at: live.seen_at,
        }
      : null,
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

export function formatLive(mins: number): string {
  return mins >= 60 ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分` : `${mins} 分`;
}
