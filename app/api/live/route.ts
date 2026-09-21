import { connection } from "next/server";
import { getLiveByUids } from "@/lib/stars";

// Live rows for the browser-only favourites view (uids from localStorage).
export async function GET(request: Request) {
  await connection();
  const raw = new URL(request.url).searchParams.get("uids") ?? "";
  const uids = [...new Set(raw.split(",").filter((s) => /^\d{1,16}$/.test(s)))].slice(0, 200).map(Number);
  try {
    const rows = await getLiveByUids(uids);
    return Response.json({ rows, now: Date.now() }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
