import { connection } from "next/server";
import { HANDLE_RE, getPublishedSchedule } from "@/lib/schedule";
import { currentWeekStart } from "@/lib/time";

// Published schedule JSON: current week + next 3, Asia/Shanghai. Public, CORS *,
// CDN-cached briefly. The data itself comes from the tagged `use cache` entry.
export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  await connection(); // "current week" depends on now → request time, not build time
  const { handle } = await ctx.params;
  if (!HANDLE_RE.test(handle)) return notFound();

  const data = await getPublishedSchedule(handle, currentWeekStart());
  if (!data) return notFound();

  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function notFound() {
  return Response.json(
    { error: "not_found" },
    { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
