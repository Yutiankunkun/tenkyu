import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { fetchLiveProfile, fetchRoomInit } from "@/lib/bilibili";

// 观星台 read model. Gate = account level >= 3, account not deleted, seen in the
// last STARS_STALE_MIN minutes. The raw band fetch is cached for a minute so the
// board and the home teaser do not hit Supabase on every request.

import {
  BAND_LIMIT,
  LEVEL_GATE,
  PAGE_SIZE,
  STARS_STALE_MIN,
  TOPICS,
  topicOf,
  type Band,
  type Sort,
  type StarRow,
  type Topic,
} from "@/lib/stars-shared";

export * from "@/lib/stars-shared";

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

export type StarsQuery = { band: Band; topic: Topic | null; q: string | null; sort: Sort; page: number; size?: number };

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
const escapeLike = (s: string) => s.replace(/[\%_]/g, (c) => "\\" + c);

type StarsPageRpc = { total: number; topics: { topic: Topic; n: number }[]; updated_at: string | null; rows: StarRow[] };

/** One database call (migration 0006). Cached briefly per distinct query. */
async function starsPageRpc(query: StarsQuery, size: number): Promise<StarsResult | null> {
  "use cache";
  cacheTag("stars");
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const sb = createAnonClient();
  const { data, error } = await sb.rpc("stars_page", {
    p_fans_lt: BAND_LIMIT[query.band],
    p_topic: query.topic,
    p_q: query.q ? escapeLike(query.q) : null,
    p_sort: query.sort,
    p_page: Math.max(1, query.page),
    p_size: size,
    p_stale_minutes: STARS_STALE_MIN,
    p_level_gate: LEVEL_GATE,
  });
  if (error) {
    if (error.code === "PGRST202" || /stars_page/.test(error.message)) return null; // migration not applied yet
    throw error;
  }
  const r = data as StarsPageRpc;
  const pages = Math.max(1, Math.ceil(r.total / size));
  return {
    rows: (r.rows ?? []).map((x) => ({ ...x, tags: x.tags ?? [] })),
    total: r.total,
    page: Math.min(Math.max(1, query.page), pages),
    pages,
    topics: r.topics ?? [],
    updatedAt: r.updated_at,
    now: Date.now(),
  };
}

/** In-memory fallback over the cached band fetch (used until 0006 is applied). */
async function starsPageInMemory(query: StarsQuery, size: number): Promise<StarsResult> {
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
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, query.page), pages);
  const updatedAt = all.length ? all.map((r) => r.seen_at).sort().at(-1)! : null;
  return { rows: rows.slice((page - 1) * size, page * size), total, page, pages, topics, updatedAt, now: Date.now() };
}

export async function getStars(query: StarsQuery): Promise<StarsResult> {
  const size = query.size ?? PAGE_SIZE;
  return (await starsPageRpc(query, size)) ?? starsPageInMemory(query, size);
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


// ---------------------------------------------------------------- /stars/check
export type CheckResult =
  | { kind: "invalid" }
  | {
      kind: "known";
      uid: number;
      room_id: number | null;
      uname: string;
      face: string;
      level: number | null;
      fans: number | null;
      first_seen_at: string;
      last_seen_at: string;
      deleted: boolean;
      live: { title: string; area: string; started_at: string | null } | null;
      handle: string | null;
      now: number;
    }
  | { kind: "unknown"; uid: number; room_id: number | null; uname: string; area: string; live_status: number }
  | { kind: "missing"; input: number }
  | { kind: "unavailable"; input: number };

/** Parse digits, a live.bilibili.com/<room> URL or a space.bilibili.com/<uid> URL. */
export function parseCheckInput(raw: string): { n: number; hint: "room" | "uid" | null } | null {
  const s = raw.trim();
  let m = /live\.bilibili\.com\/(?:h5\/)?(\d{1,12})/.exec(s);
  if (m) return { n: Number(m[1]), hint: "room" };
  m = /space\.bilibili\.com\/(\d{1,16})/.exec(s);
  if (m) return { n: Number(m[1]), hint: "uid" };
  if (/^\d{1,16}$/.test(s)) return { n: Number(s), hint: null };
  return null;
}

type KnownRow = {
  uid: number;
  room_id: number | null;
  uname: string;
  face: string;
  level: number | null;
  fans: number | null;
  first_seen_at: string;
  last_seen_at: string;
  deleted_at: string | null;
};

/** Everything the check page needs for one room id / uid. Never throws; Bilibili failure → "unavailable". */
export async function getCheck(raw: string): Promise<CheckResult> {
  const parsed = parseCheckInput(raw);
  if (!parsed) return { kind: "invalid" };
  const { n, hint } = parsed;
  const sb = createAnonClient();
  const cols = "uid, room_id, uname, face, level, fans, first_seen_at, last_seen_at, deleted_at";
  let row: KnownRow | null = null;
  if (hint !== "uid") {
    const { data } = await sb.from("bili_streamer").select(cols).eq("room_id", n).limit(1).maybeSingle<KnownRow>();
    row = data ?? null;
  }
  if (!row && hint !== "room") {
    const { data } = await sb.from("bili_streamer").select(cols).eq("uid", n).maybeSingle<KnownRow>();
    row = data ?? null;
  }
  if (row) {
    const [{ data: live }, { data: claimed }] = await Promise.all([
      sb
        .from("live_now")
        .select("title, area, started_at, seen_at")
        .eq("uid", row.uid)
        .gt("seen_at", new Date(Date.now() - STARS_STALE_MIN * 60 * 1000).toISOString())
        .maybeSingle<{ title: string; area: string; started_at: string | null; seen_at: string }>(),
      sb.from("streamer").select("handle").eq("bili_uid", row.uid).eq("status", "active").maybeSingle<{ handle: string }>(),
    ]);
    return {
      kind: "known",
      uid: row.uid,
      room_id: row.room_id,
      uname: row.uname,
      face: row.face,
      level: row.level,
      fans: row.fans,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      deleted: row.deleted_at !== null,
      live: live ? { title: live.title, area: live.area, started_at: live.started_at } : null,
      handle: claimed?.handle ?? null,
      now: Date.now(),
    };
  }
  // Not observed yet: ask Bilibili whether the id exists at all.
  try {
    let uid = n;
    let roomId: number | null = null;
    let liveStatus = 0;
    if (hint !== "uid") {
      const init = await fetchRoomInit(n);
      if (init) {
        uid = init.uid;
        roomId = init.room_id;
        liveStatus = init.live_status;
      } else if (hint === "room") {
        return { kind: "missing", input: n };
      }
    }
    const p = await fetchLiveProfile(uid);
    if (!p.uname) return { kind: "missing", input: n };
    return { kind: "unknown", uid, room_id: roomId ?? p.room_id, uname: p.uname, area: p.area, live_status: liveStatus || p.live_status };
  } catch {
    return { kind: "unavailable", input: n };
  }
}
