import { connection } from "next/server";

// Image proxy for canvas drawing: Bilibili's CDN sends no CORS headers, so the
// browser cannot draw those images onto a canvas without tainting it. We fetch
// with no referer and re-serve with CORS. Allow-listed hosts only.
const ALLOWED_HOST = /(^|\.)hdslb\.com$/i;
const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(request: Request) {
  await connection();
  const u = new URL(request.url).searchParams.get("u");
  let target: URL;
  try {
    target = new URL(u ?? "");
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) {
    return new Response("host not allowed", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) {
    return new Response("not an image", { status: 502 });
  }
  const len = Number(upstream.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return new Response("too large", { status: 413 });
  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });

  return new Response(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
