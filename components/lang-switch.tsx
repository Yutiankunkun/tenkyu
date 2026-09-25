"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale, switchPath } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/**
 * Link to the same page in the other locale. Reads the URL, so it must sit inside a
 * <Suspense> boundary (Cache Components prerenders the shell without URL data). The query
 * string is not carried over. usePathname() returns the internal path after proxy.ts has
 * rewritten it, so the default locale's prefix ("/zh-CN") can be present too — strip any.
 */
export function LangSwitch({ className }: { className?: string }) {
  const { locale, m } = useI18n();
  const pathname = usePathname() ?? "/";
  const first = pathname.split("/")[1] ?? "";
  const base = isLocale(first) ? pathname.slice(first.length + 1) || "/" : pathname;
  const other = switchPath(locale, base);
  return (
    <Link href={other.href} hrefLang={other.locale} className={className} aria-label={m.nav.switch}>
      {m.nav.switch}
    </Link>
  );
}
