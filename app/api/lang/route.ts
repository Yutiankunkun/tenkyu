import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, isLocale, localePath } from "@/lib/i18n";

// Records the language choice (one-year cookie, read by proxy.ts) and lands on the same page
// in that language. `next` must be a site-relative path; anything else falls back to "/".
export function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const rawNext = request.nextUrl.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const locale = isLocale(to) ? to : "zh-CN";
  const res = NextResponse.redirect(new URL(localePath(locale, next), request.url), 303);
  res.cookies.set(LANG_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
