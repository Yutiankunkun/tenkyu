import { connection } from "next/server";
import { fetchOnline } from "@/lib/bilibili";

// Logged-in viewer count for one room, for the watch page. Cached at the edge for 60 s per
// (uid, room) so a busy watch page costs Bilibili at most one call a minute.
export async function GET(request: Request) {
  await connection();
  const p = new URL(request.url).searchParams;
  const uid = p.get("uid") ?? "";
  const room = p.get("room") ?? "";
  if (!/^\d{1,16}$/.test(uid) || !/^\d{1,12}$/.test(room)) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const online = await fetchOnline(Number(uid), Number(room)).catch(() => null);
  return Response.json(
    { online, at: Date.now() },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
