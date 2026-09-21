"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FAVS_KEY, FavButton, parseFavs } from "@/components/fav-button";
import { useLocalString } from "@/lib/local-store";
import { formatFans, formatLive, minutesLive, type StarRow } from "@/lib/stars";

type Props = {
  rows: StarRow[];
  claimed: [number, string][]; // uid → handle
  now: number;
  updatedAt: string | null;
};

type Offline = { uid: number; uname: string; face: string; room_id: number | null; fans: number | null; last_seen_at: string };

const PAGE = 60;

/** 观星台 card grid. Client-side so ♡ and 「只看收藏」 work without an account. */
export function StarsGrid({ rows, claimed, now, updatedAt }: Props) {
  const claimedMap = useMemo(() => new Map(claimed), [claimed]);
  const favs = parseFavs(useLocalString(FAVS_KEY));
  const favSet = useMemo(() => new Set(favs), [favs]);
  const [favsOnly, setFavsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [offline, setOffline] = useState<Offline[]>([]);

  const shown = favsOnly ? rows.filter((r) => favSet.has(r.uid)) : rows;
  const total = shown.length;
  const pageRows = favsOnly ? shown : shown.slice((page - 1) * PAGE, page * PAGE);

  // Favourites that are not live right now: look them up for a compact list.
  const liveUids = useMemo(() => new Set(rows.map((r) => r.uid)), [rows]);
  const offlineKey = favsOnly ? favs.filter((u) => !liveUids.has(u)).join(",") : "";
  useEffect(() => {
    if (!offlineKey) return;
    let cancelled = false;
    fetch(`/api/streamers?uids=${offlineKey}`)
      .then((r) => (r.ok ? r.json() : { streamers: [] }))
      .then((j) => {
        if (!cancelled) setOffline((j.streamers ?? []) as Offline[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [offlineKey]);

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {total} 位在播
          {updatedAt
            ? ` · 更新于 ${new Date(updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" })}（北京时间）`
            : ""}
        </p>
        <button type="button" onClick={() => setFavsOnly((v) => !v)} className={chip(favsOnly)} aria-pressed={favsOnly}>
          ♥ 只看收藏{favs.length ? ` (${favs.length})` : ""}
        </button>
      </div>

      {pageRows.length === 0 ? (
        <p className="text-muted">
          {favsOnly
            ? favs.length
              ? "收藏的主播现在都没在播。"
              : "还没有收藏。在卡片或观看页点 ♡ 就会出现在这里，只保存在这个浏览器里。"
            : updatedAt
              ? "这个筛选下现在没有人在播。"
              : "暂无数据，采集器可能还没跑起来。"}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageRows.map((r) => {
            const handle = claimedMap.get(r.uid);
            const mins = minutesLive(r.started_at, now);
            return (
              <li key={r.uid} className="overflow-hidden rounded-xl border border-line bg-bg">
                <Link href={`/watch/${r.room_id}`} className="block">
                  <div className="aspect-video bg-fg/5">
                    {r.keyframe || r.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.keyframe || r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
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
                      {handle ? (
                        <Link href={`/${handle}`} className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                          已入驻
                        </Link>
                      ) : null}
                    </div>
                    <div className="truncate text-sm text-fg/80">{r.title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                      {r.area ? <span>{r.area}</span> : null}
                      <span>{formatFans(r.bili_streamer.fans)}</span>
                      {mins !== null ? <span>已播 {formatLive(mins)}</span> : null}
                    </div>
                    {r.tags.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.tags.slice(0, 4).map((t) => (
                          <Link key={t} href={`/stars?tag=${encodeURIComponent(t)}`} className="rounded-full border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-fg">
                            {t}
                          </Link>
                        ))}
                      </div>
                    ) : null}
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
                  {handle ? (
                    <Link href={`/${handle}`} className="text-muted hover:text-fg">
                      看她的日程
                    </Link>
                  ) : (
                    <Link href="/apply" className="text-muted hover:text-fg">
                      这是你？申请入驻
                    </Link>
                  )}
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

      {!favsOnly && total > PAGE ? (
        <nav className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-muted hover:text-fg disabled:opacity-40">
            ← 上一页
          </button>
          <span className="text-muted">
            {page} / {Math.ceil(total / PAGE)}
          </span>
          <button type="button" disabled={page * PAGE >= total} onClick={() => setPage((p) => p + 1)} className="text-muted hover:text-fg disabled:opacity-40">
            下一页 →
          </button>
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
