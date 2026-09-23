import "server-only";

// Bilibili live batch endpoint (unofficial). Verified 2026-09-20 from a home IP;
// datacenter IPs (Vercel) may be refused — callers must degrade gracefully.
export type BiliLiveProfile = {
  uid: number;
  uname: string;
  face: string;
  room_id: number | null;
  area: string;
  live_status: number;
  title: string;
};

export async function fetchLiveProfile(uid: number): Promise<BiliLiveProfile> {
  const body = new URLSearchParams();
  body.append("uids[]", String(uid));
  const res = await fetch("https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids", {
    method: "POST",
    headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bilibili HTTP ${res.status}`);
  const json = (await res.json()) as { code: number; message?: string; data?: unknown };
  if (json.code !== 0) throw new Error(`Bilibili code ${json.code} ${json.message ?? ""}`.trim());
  const rows = Array.isArray(json.data) ? json.data : Object.values(json.data ?? {});
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) throw new Error("该 UID 没有直播间信息");
  return {
    uid,
    uname: String(r.uname ?? ""),
    face: String(r.face ?? ""),
    room_id: typeof r.room_id === "number" && r.room_id > 0 ? r.room_id : null,
    area: [r.area_v2_parent_name, r.area_v2_name].filter(Boolean).join(" · "),
    live_status: Number(r.live_status ?? 0),
    title: String(r.title ?? ""),
  };
}

// Logged-in viewers currently in a room — the figure Bilibili shows above the 高能榜.
// Verified 2026-09-22: 2 024/2 025 live rooms answered at 0.15 s spacing from a home IP,
// GitHub runners reach it too. Offline room → 0. This is NOT 同接 (guests are excluded),
// so the UI says 「在线」, never 「正在观看」. Returns null when the endpoint misbehaves.
export async function fetchOnline(uid: number, roomId: number): Promise<number | null> {
  const url = `https://api.live.bilibili.com/xlive/general-interface/v1/rank/getOnlineGoldRank?ruid=${uid}&roomId=${roomId}&page=1&pageSize=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { code: number; data?: { onlineNum?: unknown } };
  if (json.code !== 0) return null;
  const n = json.data?.onlineNum;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

// room id → uid (and live status). `room_init` needs no wbi; verified 2026-09-23. Unknown room → non-zero code.
export async function fetchRoomInit(roomId: number): Promise<{ uid: number; room_id: number; live_status: number } | null> {
  const res = await fetch(`https://api.live.bilibili.com/room/v1/Room/room_init?id=${roomId}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bilibili HTTP ${res.status}`);
  const json = (await res.json()) as { code: number; data?: { uid?: number; room_id?: number; live_status?: number } };
  if (json.code !== 0 || !json.data?.uid) return null;
  return { uid: json.data.uid, room_id: json.data.room_id ?? roomId, live_status: Number(json.data.live_status ?? 0) };
}
