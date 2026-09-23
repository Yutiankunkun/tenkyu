// Client-safe part of the observatory model: types, constants and pure helpers.
// Server-only reads (cached Supabase queries) live in lib/stars.ts.

export const STARS_STALE_MIN = 20;
export const LEVEL_GATE = 3;
export type Band = "new" | "small" | "all";
export const BAND_LIMIT: Record<Band, number | null> = { new: 1000, small: 10000, all: null };
export type Sort = "new" | "small";
export const SORT_LABEL: Record<Sort, string> = { new: "刚开播", small: "粉丝少" };
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
  bili_streamer: { uname: string; face: string; fans: number | null; level: number | null };
};

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
