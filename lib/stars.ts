import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

// 观星台 read model. Gate = account level >= 3, account not deleted, seen in the
// last STARS_STALE_MIN minutes. The raw band fetch is cached for a minute so the
// board and the home teaser do not hit Supabase on every request.

export const STARS_STALE_MIN = 20;
export const LEVEL_GATE = 3;
export type Band = "new" | "small" | "all";
export const BAND_LIMIT: Record<Band, number | null> = { new: 1000, small: 10000, all: null };
export type Sort = "new" | "small";
export const SORT_LABEL: Record<Sort, string> = { new: "刚开播", small: "粉丝少" };
export const PAGE_SIZE = 60;

/** Bilibili 分区 → a small topic set (Holodex-style), the only category filter we show. */
export const TOPICS = ["杂谈", "歌", "游戏", "电台", "其他"] as const;
export type Topic = (typeof TOPICS)[number];
export function topicOf(area: string): Topic {
  if (/Singer|唱|歌/.test(area)) return "歌";
  if (/Gamer|游戏/.test(area)) return "游戏";
  if (/声优|电台/.test(area)) return "电台";
  if (/日常|杂谈|男V|虚拟主播/.test(area)) return "杂谈";
  return "其他";
}

export type StarRow = {
  uid: number;
  room_id: number;
  title: string;
  cover: string;
  tags: string[];
  area: string;
  started_at: string | null;
  seen_at: string;
  bili_streamer: { uname: string; face: string; fans: number | null; level: number | null };
};

export type ClaimedMap = Map<number, string>; // bili_uid → handle

/** Cached raw fetch of every gated live row in a band (no keyframe: cards use covers). */
export async function fetchBandRows(band: Band): Promise<StarRow[]> {
  "use cache";
  cacheTag("stars");
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });

  const sb = createAnonClient();
  const since = new Date(Date.now() - STARS_STALE_MIN * 60 * 1000).toISOString();
  let q = sb
    .from("live_now")
    .select("uid, room_id, title, cover, tags, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level)")
    .gte("seen_at", since)
    .gte("bili_streamer.level", LEVEL_GATE)
    .is("bili_streamer.deleted_at", null)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(3000);
  const limit = BAND_LIMIT[band];
  if (limit !== null) q = q.lt("bili_streamer.fans", limit);
  const { data, error } = await q.returns<StarRow[]>();
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, tags: r.tags ?? [] }));
}

export type StarsQuery = { band: Band; topic: Topic | null; q: string | null; sort: Sort; page: number };

export type StarsResult = {
  rows: StarRow[]; // current page only
  total: number;
  page: number;
  pages: number;
  topics: { topic: Topic; n: number }[];
  updatedAt: string | null;
  now: number;
};

const norm = (s: string) => s.toLowerCase();

export async function getStars(query: StarsQuery): Promise<StarsResult> {
  const all = await fetchBandRows(query.band);

  const topicCount = new Map<Topic, number>();
  for (const r of all) {
    const t = topicOf(r.area);
    topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  }
  const topics = TOPICS.filter((t) => topicCount.has(t)).map((t) => ({ topic: t, n: topicCount.get(t)! }));

  let rows = all;
  if (query.topic) rows = rows.filter((r) => topicOf(r.area) === query.topic);
  if (query.q) {
    const needle = norm(query.q);
    rows = rows.filter(
      (r) => norm(r.bili_streamer.uname).includes(needle) || norm(r.title).includes(needle) || r.tags.some((t) => norm(t).includes(needle)),
    );
  }
  const byStart = (a: StarRow, b: StarRow) => (b.started_at ?? "").localeCompare(a.started_at ?? "");
  if (query.sort === "small") rows = [...rows].sort((a, b) => (a.bili_streamer.fans ?? 1e9) - (b.bili_streamer.fans ?? 1e9) || byStart(a, b));
  else rows = [...rows].sort(byStart);

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const updatedAt = all.length ? all.map((r) => r.seen_at).sort().at(-1)! : null;
  return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, pages, topics, updatedAt, now: Date.now() };
}

/** Live rows for specific uids (favourites view), gate applied. */
export async function getLiveByUids(uids: number[]): Promise<StarRow[]> {
  if (uids.length === 0) return [];
  const sb = createAnonClient();
  const since = new Date(Date.now() - STARS_STALE_MIN * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("live_now")
    .select("uid, room_id, title, cover, tags, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level)")
    .in("uid", uids)
    .gte("seen_at", since)
    .gte("bili_streamer.level", LEVEL_GATE)
    .is("bili_streamer.deleted_at", null)
    .returns<StarRow[]>();
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, tags: r.tags ?? [] }));
}

/** Active onboarded streamers keyed by Bilibili uid, for the 已入驻 badge. */
export async function getClaimed(): Promise<ClaimedMap> {
  "use cache";
  cacheTag("streamers");
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
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
  live: { title: string; cover: string; keyframe: string; area: string; started_at: string | null; seen_at: string } | null;
  handle: string | null;
  now: number;
};

/** Everything the watch page needs for one room: streamer facts + live state (if live) + claimed handle. */
export async function getWatch(roomId: number): Promise<WatchData | null> {
  const sb = createAnonClient();
  const { data: live } = await sb
    .from("live_now")
    .select("uid, room_id, title, cover, keyframe, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level, deleted_at)")
    .eq("room_id", roomId)
    .maybeSingle<{
      uid: number;
      room_id: number;
      title: string;
      cover: string;
      keyframe: string | null;
      area: string;
      started_at: string | null;
      seen_at: string;
      bili_streamer: { uname: string; face: string; fans: number | null; level: number | null; deleted_at: string | null };
    }>();

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
  const claimed = await getClaimed();
  const fresh = live && Date.parse(live.seen_at) > Date.now() - STARS_STALE_MIN * 60 * 1000;
  return {
    uid,
    room_id: roomId,
    uname: base.uname,
    face: base.face,
    fans: base.fans,
    level: base.level,
    live: fresh
      ? { title: live.title, cover: live.cover, keyframe: live.keyframe ?? "", area: live.area, started_at: live.started_at, seen_at: live.seen_at }
      : null,
    handle: claimed.get(uid) ?? null,
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
