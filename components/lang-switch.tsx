"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchPath } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/**
 * Link to the same page in the other locale. Reads the URL, so it must sit inside a
 * <Suspense> boundary (Cache Components prerenders the shell without URL data). The query
 * string is not carried over.
 */
export function LangSwitch({ className }: { className?: string }) {
  const { locale, m } = useI18n();
  const pathname = usePathname() ?? "/";
  const base = locale === "en" && pathname.startsWith("/en") ? pathname.slice(3) || "/" : pathname;
  const other = switchPath(locale, base);
  return (
    <Link href={other.href} hrefLang={other.locale} className={className} aria-label={m.nav.switch}>
      {m.nav.switch}
    </Link>
  );
}
