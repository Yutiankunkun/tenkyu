// Client-safe part of the observatory model: types, constants and pure helpers.
// Server-only reads (cached Supabase queries) live in lib/stars.ts. User-facing labels live
// in lib/i18n/messages; this file holds keys only.

export const STARS_STALE_MIN = 20;
export const LEVEL_GATE = 3;
export type Band = "new" | "small" | "all";
export const BAND_LIMIT: Record<Band, number | null> = { new: 1000, small: 10000, all: null };

/**
 * Board order (migration 0009). 'rank' = observed-weeks tier first, rooms with nobody online
 * last, then a shuffle that is stable for one sweep; 'online' = fewest logged-in viewers first.
 */
export const SORTS = ["rank", "online", "small", "new"] as const;
export type Sort = (typeof SORTS)[number];
export const DEFAULT_SORT: Sort = "rank";

/** Bands of the logged-in viewer count. The ≤ 10 band is deliberately never split further. */
export const ONLINE_BANDS = ["le10", "11_30", "31_50", "gt50"] as const;
export type OnlineBand = (typeof ONLINE_BANDS)[number];
export type OnlineCounts = { le10: number; b11_30: number; b31_50: number; gt50: number; unknown: number };
export const ONLINE_COUNT_KEY: Record<OnlineBand, keyof OnlineCounts> = { le10: "le10", "11_30": "b11_30", "31_50": "b31_50", gt50: "gt50" };
export const PAGE_SIZE = 60;

/**
 * Bilibili live area → a small topic set (Holodex-style), the only category filter we show.
 * Keys are stable in URLs and code; the SQL function (stars_page) speaks the Chinese labels.
 */
export const TOPIC_KEYS = ["talk", "song", "game", "radio", "other"] as const;
export type TopicKey = (typeof TOPIC_KEYS)[number];
export const TOPIC_SQL: Record<TopicKey, string> = { talk: "杂谈", song: "歌", game: "游戏", radio: "电台", other: "其他" };
export const TOPIC_KEY_OF_SQL: Record<string, TopicKey> = Object.fromEntries(Object.entries(TOPIC_SQL).map(([k, v]) => [v, k as TopicKey]));
export function topicOf(area: string): TopicKey {
  if (/Singer|唱|歌/.test(area)) return "song";
  if (/Gamer|游戏/.test(area)) return "game";
  if (/声优|电台/.test(area)) return "radio";
  if (/日常|杂谈|男V|虚拟主播/.test(area)) return "talk";
  return "other";
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
  online_count: number | null; // logged-in viewers; null until the online collector has visited the room
  online_fetched_at: string | null;
  weeks_observed: number; // distinct weeks the collector saw the room live (26-week window)
  bili_streamer: { uname: string; face: string; fans: number | null; level: number | null };
};

export function minutesLive(startedAt: string | null, now: number): number | null {
  if (!startedAt) return null;
  return Math.max(0, Math.round((now - Date.parse(startedAt)) / 60000));
}
