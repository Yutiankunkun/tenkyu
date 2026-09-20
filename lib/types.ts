// Row shapes for the v1 schema (supabase/migrations/0001_init.sql). Hand-written;
// no codegen. Keep in sync with the migration.

export type StreamerStatus = "invited" | "active" | "hidden";

export type StreamerRow = {
  id: string;
  handle: string;
  auth_email: string;
  display_name: string;
  avatar_url: string;
  bili_uid: number | null;
  bili_room_id: number | null;
  theme_color: string;
  intro: string;
  status: StreamerStatus;
  created_at: string;
  updated_at: string;
};

export type SlotTemplateRow = {
  id: string;
  streamer_id: string;
  weekday: number; // 1..7, Monday = 1
  start_min: number; // minutes from 00:00 Asia/Shanghai
  end_min: number; // may exceed 1439 (past midnight)
  type: string;
  note: string;
};

export type OverrideMode = "replace" | "off";

export type Slot = {
  start_min: number;
  end_min: number;
  type: string;
  note: string;
};

export type WeekOverrideRow = {
  id: string;
  streamer_id: string;
  week_start: string; // YYYY-MM-DD (Monday)
  weekday: number;
  mode: OverrideMode;
  slots: Slot[];
  updated_at: string;
};

// Published (public) shapes — what /data/<handle> returns and what pages render.
export type PublishedSlot = {
  start: string; // "HH:MM" Asia/Shanghai; end may be "25:30" for past-midnight
  end: string;
  type: string;
  note: string;
};

export type PublishedDay = {
  weekday: number; // 1..7
  date: string; // YYYY-MM-DD
  off: boolean;
  overridden: boolean;
  slots: PublishedSlot[];
};

export type PublishedWeek = {
  week_start: string;
  days: PublishedDay[];
};

export type PublishedStreamer = {
  handle: string;
  display_name: string;
  avatar_url: string;
  theme_color: string;
  intro: string;
  bili_room_url: string | null;
};

export type PublishedSchedule = PublishedStreamer & {
  generated_at: string;
  timezone: "Asia/Shanghai";
  weeks: PublishedWeek[];
};

export const SLOT_TYPES = ["杂谈", "游戏", "歌回", "联动", "其他"] as const;
export const WEEKDAY_LABELS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
