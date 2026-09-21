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
