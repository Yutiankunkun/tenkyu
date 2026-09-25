"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FAVS_KEY, FavButton, parseFavs } from "@/components/fav-button";
import { StarCard } from "@/components/star-card";
import { fmt, formatDay, formatFans, localePath } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { useLocalString } from "@/lib/local-store";
import type { StarRow } from "@/lib/stars-shared";

type Offline = { uid: number; uname: string; face: string; room_id: number | null; fans: number | null; last_seen_at: string };

export function FavoritesView() {
  const { locale, m } = useI18n();
  const favs = parseFavs(useLocalString(FAVS_KEY));
  const key = favs.join(",");
  const [live, setLive] = useState<StarRow[] | null>(null);
  const [offline, setOffline] = useState<Offline[]>([]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!key) return; // nothing to fetch; the empty state renders from favs.length
    let cancelled = false;
    Promise.all([
      fetch(`/api/live?uids=${key}`).then((r) => (r.ok ? r.json() : { rows: [], now: null })),
      fetch(`/api/streamers?uids=${key}`).then((r) => (r.ok ? r.json() : { streamers: [] })),
    ])
      .then(([l, off]) => {
        if (cancelled) return;
        const rows = (l.rows ?? []) as StarRow[];
        const liveUids = new Set(rows.map((r) => r.uid));
        setLive(rows);
        setNow(typeof l.now === "number" ? l.now : null);
        setOffline(((off.streamers ?? []) as Offline[]).filter((s) => !liveUids.has(s.uid)));
      })
      .catch(() => {
        if (!cancelled) setLive([]);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold">{m.favorites.title}</h1>
        <p className="mt-1 text-sm text-muted">{m.favorites.intro}</p>
      </header>

      {favs.length === 0 ? (
        <p className="text-muted">{m.favorites.empty}</p>
      ) : live === null ? (
        <p className="text-muted">{m.favorites.loading}</p>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted">
              {m.favorites.liveNow} <span className="text-faint">{live.length}</span>
            </h2>
            {live.length === 0 ? (
              <p className="text-muted">{m.favorites.noneLive}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {live.map((r) => (
                  <li key={r.uid}>
                    <StarCard r={r} now={now ?? Date.parse(r.seen_at)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {offline.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">
                {m.favorites.offline} <span className="text-faint">{offline.length}</span>
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
                {offline.map((s) => (
                  <li key={s.uid} className="flex items-center gap-3 px-3 py-2">
                    <Avatar src={s.face} name={s.uname} size={36} />
                    <div className="min-w-0 flex-1">
                      {s.room_id ? (
                        <Link href={localePath(locale, `/watch/${s.room_id}`)} className="truncate text-sm font-medium hover:underline">
                          {s.uname}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-medium">{s.uname}</span>
                      )}
                      <div className="text-xs text-muted">
                        {formatFans(s.fans, m, locale)} · {fmt(m.favorites.lastSeen, { date: formatDay(s.last_seen_at, locale) })}
                      </div>
                    </div>
                    <FavButton uid={s.uid} name={s.uname} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
