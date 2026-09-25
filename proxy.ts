import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale, pickLocale } from "@/lib/i18n";

// Locale routing. Every page lives under app/[locale]; the default locale is unprefixed in
// public URLs.
//   "/en/watch/1"     → passes through.
//   "/zh-CN/..."      → 308 to the unprefixed form (one canonical URL).
//   "/watch/1"        → first visit (no preference cookie): redirect to the browser's language
//                       when it is not zh-CN; with a cookie: redirect to the remembered locale
//                       when it is not zh-CN; otherwise rewrite to "/zh-CN/watch/1" internally.
// The cookie is written only by /api/lang (an explicit choice in Settings), so a visitor who
// picked zh-CN never gets bounced by Accept-Language again.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) {
    if (first === DEFAULT_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(first.length + 1) || "/";
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }
  const cookie = request.cookies.get(LANG_COOKIE)?.value;
  const preferred = isLocale(cookie) ? cookie : pickLocale(request.headers.get("accept-language"));
  if (preferred !== DEFAULT_LOCALE) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url, 307);
  }
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages only: skip API routes, Next internals and files with an extension (icons, fonts, images).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
