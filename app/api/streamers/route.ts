import { connection } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

// Public lookup of collector facts for a few uids (used by the browser-only
// favourites list to show streamers who are not live right now).
export async function GET(request: Request) {
  await connection();
  const raw = new URL(request.url).searchParams.get("uids") ?? "";
  const uids = [...new Set(raw.split(",").filter((s) => /^\d{1,16}$/.test(s)))].slice(0, 200);
  if (uids.length === 0) return Response.json({ streamers: [] });

  const sb = createAnonClient();
  const { data, error } = await sb
    .from("bili_streamer")
    .select("uid, uname, face, room_id, fans, level, last_seen_at, deleted_at")
    .in("uid", uids)
    .is("deleted_at", null);
  if (error) return Response.json({ error: "unavailable" }, { status: 503 });

  return Response.json(
    { streamers: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
