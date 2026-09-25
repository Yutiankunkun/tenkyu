"use client";

import Link from "next/link";
import { Suspense } from "react";
import { LangSwitch } from "@/components/lang-switch";
import { localePath, switchPath } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

export function SiteHeader() {
  const { locale, m } = useI18n();
  const item = "whitespace-nowrap rounded-md px-1.5 py-1 text-sm text-muted hover:text-fg sm:px-2";
  const switchClass = `${item} border border-line`;
  // Fallback while the URL is unknown (static shell): switch to the other locale's home.
  const fallback = switchPath(locale, "/");
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href={localePath(locale, "/")} className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent" aria-hidden />
          {m.site.short} <span className="hidden text-xs font-normal text-muted sm:inline">{m.site.latin}</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link href={localePath(locale, "/")} className={item}>
            {m.nav.board}
          </Link>
          <Link href={localePath(locale, "/check")} className={item}>
            {m.nav.check}
          </Link>
          <Link href={localePath(locale, "/about")} className={item}>
            {m.nav.about}
          </Link>
          <Suspense
            fallback={
              <Link href={fallback.href} hrefLang={fallback.locale} className={switchClass}>
                {m.nav.switch}
              </Link>
            }
          >
            <LangSwitch className={switchClass} />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
