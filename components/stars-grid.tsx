"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FAVS_KEY, FavButton, parseFavs } from "@/components/fav-button";
import { useLocalString } from "@/lib/local-store";
import { formatFans, formatLive, minutesLive, topicOf, type StarRow } from "@/lib/stars-shared";

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
  const pageHref = (p: number) => (p <= 1 ? pageBase : `${pageBase}${pageBase.includes("?") ? "&" : "?"}p=${p}`);
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
          {favsOnly ? `${shown.length} 位收藏在播` : `${total} 位在播`}
          {updatedAt
            ? ` · 更新于 ${new Date(updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" })}（北京时间）`
            : ""}
        </p>
        <button type="button" onClick={() => setFavsOnly((v) => !v)} className={chip(favsOnly)} aria-pressed={favsOnly}>
          ♥ 只看收藏{favs.length ? ` (${favs.length})` : ""}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted">
          {favsOnly
            ? favs.length
              ? favLive === null
                ? "加载中…"
                : "收藏的主播现在都没在播。"
              : "还没有收藏。在卡片或观看页点 ♡ 就会出现在这里，只保存在这个浏览器里。"
            : updatedAt
              ? "这个筛选下现在没有人在播。"
              : "暂无数据，采集器可能还没跑起来。"}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const mins = minutesLive(r.started_at, now);
            return (
              <li key={r.uid} className="overflow-hidden rounded-xl border border-line bg-bg">
                <Link href={`/watch/${r.room_id}`} className="block">
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
                      <Link href={`/watch/${r.room_id}`} className="truncate font-medium hover:underline">
                        {r.bili_streamer.uname}
                      </Link>
                    </div>
                    <div className="truncate text-sm text-fg/80">{r.title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                      <span>{topicOf(r.area)}</span>
                      <span>{formatFans(r.bili_streamer.fans)}</span>
                      {mins !== null ? <span>已播 {formatLive(mins)}</span> : null}
                    </div>
                  </div>
                  <FavButton uid={r.uid} name={r.bili_streamer.uname} size="sm" />
                </div>
                <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs">
                  <span className="flex items-center gap-3">
                    <Link href={`/watch/${r.room_id}`} className="font-medium text-accent hover:underline">
                      在天球看
                    </Link>
                    <a href={`https://live.bilibili.com/${r.room_id}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                      去直播间 →
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
          <h2 className="text-sm font-medium text-muted">收藏 · 现在没在播</h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {offline.map((s) => (
              <li key={s.uid} className="flex items-center gap-3 px-3 py-2">
                <Avatar src={s.face} name={s.uname} color="#5b8def" size={32} />
                <div className="min-w-0 flex-1">
                  {s.room_id ? (
                    <Link href={`/watch/${s.room_id}`} className="truncate text-sm font-medium hover:underline">
                      {s.uname}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium">{s.uname}</span>
                  )}
                  <div className="text-xs text-muted">
                    {formatFans(s.fans)} · 上次直播 {hoursAgo(s.last_seen_at, now)}
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
              ← 上一页
            </Link>
          ) : (
            <span className="text-muted opacity-40">← 上一页</span>
          )}
          <span className="text-muted">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="text-muted hover:text-fg">
              下一页 →
            </Link>
          ) : (
            <span className="text-muted opacity-40">下一页 →</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function hoursAgo(iso: string, now: number): string {
  const h = Math.max(0, Math.round((now - Date.parse(iso)) / 3600000));
  if (h < 1) return "不到 1 小时前";
  if (h < 48) return `${h} 小时前`;
  return `${Math.round(h / 24)} 天前`;
}
