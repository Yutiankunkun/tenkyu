// Client-safe part of the observatory model: types, constants and pure helpers.
// Server-only reads (cached Supabase queries) live in lib/stars.ts.

export const STARS_STALE_MIN = 20;
export const LEVEL_GATE = 3;
export type Band = "new" | "small" | "all";
export const BAND_LIMIT: Record<Band, number | null> = { new: 1000, small: 10000, all: null };

/**
 * Board order (migration 0009). 'rank' = observed-weeks tier first, rooms with nobody online
 * last, then a shuffle that is stable for one sweep; 'online' = fewest logged-in viewers first.
 */
export type Sort = "rank" | "online" | "small" | "new";
export const SORT_LABEL: Record<Sort, string> = { rank: "综合", online: "在线少", small: "粉丝少", new: "刚开播" };
export const DEFAULT_SORT: Sort = "rank";

/** Bands of the logged-in viewer count. The ≤ 10 band is deliberately never split further. */
export type OnlineBand = "le10" | "11_30" | "31_50" | "gt50";
export const ONLINE_BANDS: readonly OnlineBand[] = ["le10", "11_30", "31_50", "gt50"];
export const ONLINE_LABEL: Record<OnlineBand, string> = { le10: "在线 ≤ 10", "11_30": "11–30", "31_50": "31–50", gt50: "51+" };
export type OnlineCounts = { le10: number; b11_30: number; b31_50: number; gt50: number; unknown: number };
export const ONLINE_COUNT_KEY: Record<OnlineBand, keyof OnlineCounts> = { le10: "le10", "11_30": "b11_30", "31_50": "b31_50", gt50: "gt50" };
export const PAGE_SIZE = 60;

/** Bilibili live area → a small topic set (Holodex-style), the only category filter we show. */
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
  online_count: number | null; // logged-in viewers; null until the online collector has visited the room
  online_fetched_at: string | null;
  weeks_observed: number; // distinct weeks the collector saw the room live (26-week window)
  bili_streamer: { uname: string; face: string; fans: number | null; level: number | null };
};

export function formatFans(n: number | null): string {
  if (n === null) return "";
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")} 万粉`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k 粉`;
  return `${n} 粉`;
}

/** Wording is deliberately "online", never "watching": guests are not counted. */
export function formatOnline(n: number | null): string {
  return n === null ? "" : `在线 ${n.toLocaleString("zh-CN")}`;
}

export function weeksLabel(weeks: number): string | null {
  return weeks >= 1 ? `观测 ${weeks} 周` : null;
}

export function minutesLive(startedAt: string | null, now: number): number | null {
  if (!startedAt) return null;
  return Math.max(0, Math.round((now - Date.parse(startedAt)) / 60000));
}

export function formatLive(mins: number): string {
  return mins >= 60 ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分` : `${mins} 分`;
}
