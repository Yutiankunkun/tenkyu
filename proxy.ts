import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

// Locale routing. Every page lives under app/[locale]; the default locale is unprefixed in
// public URLs. "/watch/1" → rewrite to "/zh-CN/watch/1" (URL unchanged); "/en/watch/1" passes
// through; an explicit "/zh-CN/..." redirects to the unprefixed form so there is one canonical URL.
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
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Pages only: skip API routes, Next internals and files with an extension (icons, fonts, images).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
