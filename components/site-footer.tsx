"use client";

import Link from "next/link";
import { localePath } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

export function SiteFooter() {
  const { locale, m } = useI18n();
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted">
        <span>{m.footer.copyright}</span>
        <span className="flex items-center gap-4">
          <span>{m.footer.timezone}</span>
          <Link href={localePath(locale, "/privacy")} className="hover:text-fg">
            {m.footer.privacy}
          </Link>
        </span>
      </div>
    </footer>
  );
}
