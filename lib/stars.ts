import { cacheLife, cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { fetchLiveProfile, fetchRoomInit } from "@/lib/bilibili";

// Observatory read model. Gate = account level >= 3, account not deleted, seen in the
// last STARS_STALE_MIN minutes. The raw band fetch is cached for a minute so the
// board and the home teaser do not hit Supabase on every request.

import {
  BAND_LIMIT,
  LEVEL_GATE,
  PAGE_SIZE,
  STARS_STALE_MIN,
  type Band,
  type OnlineBand,
  type OnlineCounts,
  TOPIC_KEY_OF_SQL,
  TOPIC_SQL,
  type Sort,
  type StarRow,
  type TopicKey,
} from "@/lib/stars-shared";

export * from "@/lib/stars-shared";

export type StarsQuery = { band: Band; online: OnlineBand | null; topic: TopicKey | null; q: string | null; sort: Sort; page: number; size?: number };

export type StarsResult = {
  rows: StarRow[]; // current page only
  total: number;
  page: number;
  pages: number;
  topics: { topic: TopicKey; n: number }[];
  onlineCounts: OnlineCounts | null;
  updatedAt: string | null;
  now: number;
};

const escapeLike = (s: string) => s.replace(/[\%_]/g, (c) => "\\" + c);

type StarsPageRpc = { total: number; topics: { topic: string; n: number }[]; online: OnlineCounts | null; updated_at: string | null; rows: StarRow[] };

/** One database call (migrations 0006–0009). Cached briefly per distinct query. */
async function starsPageRpc(query: StarsQuery, size: number): Promise<StarsResult> {
  "use cache";
  cacheTag("stars");
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const sb = createAnonClient();
  const { data, error } = await sb.rpc("stars_page", {
    p_fans_lt: BAND_LIMIT[query.band],
    p_topic: query.topic ? TOPIC_SQL[query.topic] : null,
    p_q: query.q ? escapeLike(query.q) : null,
    p_sort: query.sort,
    p_page: Math.max(1, query.page),
    p_size: size,
    p_stale_minutes: STARS_STALE_MIN,
    p_level_gate: LEVEL_GATE,
    p_online: query.online,
    p_seed: Math.floor(Date.now() / 600000), // one seed per ~10-minute sweep: the shuffle is stable for that long
  });
  if (error) throw error;
  const r = data as StarsPageRpc;
  const pages = Math.max(1, Math.ceil(r.total / size));
  return {
    rows: (r.rows ?? []).map((x) => ({ ...x, tags: x.tags ?? [], weeks_observed: x.weeks_observed ?? 0 })),
    total: r.total,
    page: Math.min(Math.max(1, query.page), pages),
    pages,
    topics: (r.topics ?? []).flatMap((t) => (TOPIC_KEY_OF_SQL[t.topic] ? [{ topic: TOPIC_KEY_OF_SQL[t.topic], n: t.n }] : [])),
    onlineCounts: r.online ?? null,
    updatedAt: r.updated_at,
    now: Date.now(),
  };
}

export async function getStars(query: StarsQuery): Promise<StarsResult> {
  const size = query.size ?? PAGE_SIZE;
  if (query.online === null) return starsPageRpc(query, size);
  // The SQL function counts bands after applying the band filter, so the other tabs would read 0.
  // Fetch the unfiltered counts alongside (one tiny cached call) until the function is changed.
  const [page, all] = await Promise.all([starsPageRpc(query, size), starsPageRpc({ ...query, online: null, page: 1 }, 1)]);
  return { ...page, onlineCounts: all.onlineCounts };
}

/** Live rows for specific uids (favourites view), gate applied. */
export async function getLiveByUids(uids: number[]): Promise<StarRow[]> {
  if (uids.length === 0) return [];
  const sb = createAnonClient();
  const since = new Date(Date.now() - STARS_STALE_MIN * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("live_now")
    .select("uid, room_id, title, cover, tags, area, started_at, seen_at, online_count, online_fetched_at, bili_streamer!inner(uname, face, fans, level, weeks_observed)")
    .in("uid", uids)
    .gte("seen_at", since)
    .gte("bili_streamer.level", LEVEL_GATE)
    .is("bili_streamer.deleted_at", null)
    .returns<(Omit<StarRow, "weeks_observed"> & { bili_streamer: StarRow["bili_streamer"] & { weeks_observed: number | null } })[]>();
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, tags: r.tags ?? [], weeks_observed: r.bili_streamer.weeks_observed ?? 0 }));
}

export type WatchData = {
  uid: number;
  room_id: number;
  uname: string;
  face: string;
  fans: number | null;
  level: number | null;
  weeks_observed: number;
  live: { title: string; cover: string; keyframe: string; area: string; started_at: string | null; seen_at: string } | null;
  now: number;
};

/** Everything the watch page needs for one room: streamer facts + live state (if live). */
export async function getWatch(roomId: number): Promise<WatchData | null> {
  const sb = createAnonClient();
  const { data: live } = await sb
    .from("live_now")
    .select("uid, room_id, title, cover, keyframe, area, started_at, seen_at, bili_streamer!inner(uname, face, fans, level, weeks_observed, deleted_at)")
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
      bili_streamer: { uname: string; face: string; fans: number | null; level: number | null; weeks_observed: number | null; deleted_at: string | null };
    }>();

  let uid: number;
  let base: { uname: string; face: string; fans: number | null; level: number | null; weeks_observed: number | null };
  if (live && !live.bili_streamer.deleted_at) {
    uid = live.uid;
    base = live.bili_streamer;
  } else {
    const { data: s } = await sb
      .from("bili_streamer")
      .select("uid, uname, face, fans, level, weeks_observed, deleted_at")
      .eq("room_id", roomId)
      .is("deleted_at", null)
      .maybeSingle<{ uid: number; uname: string; face: string; fans: number | null; level: number | null; weeks_observed: number | null }>();
    if (!s) return null;
    uid = s.uid;
    base = s;
  }
  const fresh = live && Date.parse(live.seen_at) > Date.now() - STARS_STALE_MIN * 60 * 1000;
  return {
    uid,
    room_id: roomId,
    uname: base.uname,
    face: base.face,
    fans: base.fans,
    level: base.level,
    weeks_observed: base.weeks_observed ?? 0,
    live: fresh
      ? { title: live.title, cover: live.cover, keyframe: live.keyframe ?? "", area: live.area, started_at: live.started_at, seen_at: live.seen_at }
      : null,
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
      weeks_observed: number;
      first_seen_at: string;
      last_seen_at: string;
      deleted: boolean;
      live: { title: string; area: string; started_at: string | null } | null;
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
  weeks_observed: number | null;
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
  const cols = "uid, room_id, uname, face, level, fans, weeks_observed, first_seen_at, last_seen_at, deleted_at";
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
    const { data: live } = await sb
      .from("live_now")
      .select("title, area, started_at, seen_at")
      .eq("uid", row.uid)
      .gt("seen_at", new Date(Date.now() - STARS_STALE_MIN * 60 * 1000).toISOString())
      .maybeSingle<{ title: string; area: string; started_at: string | null; seen_at: string }>();
    return {
      kind: "known",
      uid: row.uid,
      room_id: row.room_id,
      uname: row.uname,
      face: row.face,
      level: row.level,
      fans: row.fans,
      weeks_observed: row.weeks_observed ?? 0,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      deleted: row.deleted_at !== null,
      live: live ? { title: live.title, area: live.area, started_at: live.started_at } : null,
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
