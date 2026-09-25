"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FAVS_KEY, FavButton, parseFavs } from "@/components/fav-button";
import { fmt, formatClock, formatDay, formatFans, formatLive, formatOnline, localePath, weeksLabel } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { useLocalString } from "@/lib/local-store";
import { minutesLive, topicOf, type StarRow } from "@/lib/stars-shared";

type Props = {
  rows: StarRow[]; // one page
  total: number;
  page: number;
  pages: number;
  pageBase: string; // list URL without the page param
  now: number;
  updatedAt: string | null;
};

type Offline = { uid: number; uname: string; face: string; room_id: number | null; fans: number | null; last_seen_at: string };

/** Observatory card grid. Client-side so favourites and the favourites-only filter work without an account. */
export function StarsGrid({ rows, total, page, pages, pageBase, now, updatedAt }: Props) {
  const { locale, m } = useI18n();
  const pageHref = (p: number) => (p <= 1 ? pageBase : `${pageBase}${pageBase.includes("?") ? "&" : "?"}p=${p}`);
  const watchHref = (room: number) => localePath(locale, `/watch/${room}`);
  const favs = parseFavs(useLocalString(FAVS_KEY));
  const [favsOnly, setFavsOnly] = useState(false);
  const [favLive, setFavLive] = useState<StarRow[] | null>(null);
  const [offline, setOffline] = useState<Offline[]>([]);

  // Favourites mode: live rows + offline facts for the favourite uids (two small API calls).
  const favKey = favsOnly ? favs.join(",") : "";
  useEffect(() => {
    if (!favKey) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/live?uids=${favKey}`).then((r) => (r.ok ? r.json() : { rows: [] })),
      fetch(`/api/streamers?uids=${favKey}`).then((r) => (r.ok ? r.json() : { streamers: [] })),
    ])
      .then(([live, off]) => {
        if (cancelled) return;
        const liveRows = (live.rows ?? []) as StarRow[];
        const liveUids = new Set(liveRows.map((r) => r.uid));
        setFavLive(liveRows);
        setOffline(((off.streamers ?? []) as Offline[]).filter((s) => !liveUids.has(s.uid)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [favKey]);

  const shown = favsOnly ? (favLive ?? []) : rows;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {favsOnly ? fmt(m.grid.favLiveCount, { n: shown.length }) : fmt(m.grid.liveCount, { n: total })}
          {updatedAt ? fmt(m.grid.updatedAt, { time: formatClock(updatedAt, locale) }) : ""}
        </p>
        <button type="button" onClick={() => setFavsOnly((v) => !v)} className={chip(favsOnly)} aria-pressed={favsOnly}>
          {m.grid.favsOnly}
          {favs.length ? ` (${favs.length})` : ""}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted">
          {favsOnly
            ? favs.length
              ? favLive === null
                ? m.grid.loading
                : m.grid.noFavLive
              : m.grid.noFavs
            : updatedAt
              ? m.grid.emptyFilter
              : m.grid.noData}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const mins = minutesLive(r.started_at, now);
            const weeks = weeksLabel(r.weeks_observed, m);
            return (
              <li key={r.uid} className="overflow-hidden rounded-xl border border-line bg-bg">
                <Link href={watchHref(r.room_id)} className="block">
                  <div className="aspect-video bg-fg/5">
                    {r.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </Link>
                <div className="flex gap-3 p-3">
                  <Avatar src={r.bili_streamer.face} name={r.bili_streamer.uname} color="#5b8def" size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={watchHref(r.room_id)} className="truncate font-medium hover:underline">
                        {r.bili_streamer.uname}
                      </Link>
                    </div>
                    <div className="truncate text-sm text-fg/80">{r.title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                      {r.online_count !== null ? <span className="text-fg/80">{formatOnline(r.online_count, m, locale)}</span> : null}
                      <span>{m.topics[topicOf(r.area)]}</span>
                      <span>{formatFans(r.bili_streamer.fans, m, locale)}</span>
                      {mins !== null ? <span>{fmt(m.units.liveFor, { t: formatLive(mins, m) })}</span> : null}
                      {weeks ? <span className="text-accent">{weeks}</span> : null}
                    </div>
                  </div>
                  <FavButton uid={r.uid} name={r.bili_streamer.uname} size="sm" />
                </div>
                <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs">
                  <span className="flex items-center gap-3">
                    <Link href={watchHref(r.room_id)} className="font-medium text-accent hover:underline">
                      {m.grid.watchHere}
                    </Link>
                    <a href={`https://live.bilibili.com/${r.room_id}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                      {m.grid.goRoom}
                    </a>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {favsOnly && offline.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">{m.grid.favOffline}</h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {offline.map((s) => (
              <li key={s.uid} className="flex items-center gap-3 px-3 py-2">
                <Avatar src={s.face} name={s.uname} color="#5b8def" size={32} />
                <div className="min-w-0 flex-1">
                  {s.room_id ? (
                    <Link href={watchHref(s.room_id)} className="truncate text-sm font-medium hover:underline">
                      {s.uname}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium">{s.uname}</span>
                  )}
                  <div className="text-xs text-muted">
                    {formatFans(s.fans, m, locale)} · {fmt(m.grid.lastSeen, { date: formatDay(s.last_seen_at, locale) })}
                  </div>
                </div>
                <FavButton uid={s.uid} name={s.uname} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!favsOnly && pages > 1 ? (
        <nav className="flex items-center justify-center gap-3 text-sm">
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
