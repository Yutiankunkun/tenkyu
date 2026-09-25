"use client";

import Link from "next/link";
import { StarCard } from "@/components/star-card";
import { fmt, formatClock } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { DENSITY_GRID, useDensity } from "@/lib/prefs";
import type { StarRow } from "@/lib/stars-shared";

type Props = {
  rows: StarRow[]; // one page
  total: number;
  page: number;
  pages: number;
  pageBase: string; // list URL without the page param
  now: number;
  updatedAt: string | null;
};

/** Observatory card grid (Holodex layout: fluid columns of 16:9 cards, no card chrome). */
export function StarsGrid({ rows, total, page, pages, pageBase, now, updatedAt }: Props) {
  const { locale, m } = useI18n();
  const density = useDensity();
  const pageHref = (p: number) => (p <= 1 ? pageBase : `${pageBase}${pageBase.includes("?") ? "&" : "?"}p=${p}`);

  return (
    <div className="space-y-5">
      <p className="text-xs text-faint">
        {fmt(m.grid.liveCount, { n: total })}
        {updatedAt ? fmt(m.grid.updatedAt, { time: formatClock(updatedAt, locale) }) : ""}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted">{updatedAt ? m.grid.emptyFilter : m.grid.noData}</p>
      ) : (
        <ul className={DENSITY_GRID[density]}>
          {rows.map((r) => (
            <li key={r.uid}>
              <StarCard r={r} now={now} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-center gap-3 py-2 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-muted hover:text-fg">
              {m.grid.prev}
            </Link>
          ) : (
            <span className="text-muted opacity-40">{m.grid.prev}</span>
          )}
          <span className="text-muted">{fmt(m.grid.pageOf, { page, pages })}</span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="text-muted hover:text-fg">
              {m.grid.next}
            </Link>
          ) : (
            <span className="text-muted opacity-40">{m.grid.next}</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
