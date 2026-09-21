import { revalidateTag } from "next/cache";
import { connection } from "next/server";

// Called by the collector after it hides a claimed streamer whose Bilibili account
// disappeared. Shared secret in the x-secret header; tags limited to ours.
export async function POST(request: Request) {
  await connection();
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  const tag = new URL(request.url).searchParams.get("tag") ?? "";
  if (tag !== "streamers" && !/^schedule:[a-z0-9][a-z0-9-]{1,30}$/.test(tag)) {
    return new Response("bad tag", { status: 400 });
  }
  revalidateTag(tag, "max");
  return Response.json({ revalidated: tag });
}
