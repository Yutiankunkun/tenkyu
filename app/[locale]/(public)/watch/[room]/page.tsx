import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { FavButton } from "@/components/fav-button";
import { IconExternal } from "@/components/icons";
import { OnlineCount } from "@/components/online-count";
import { PlayerGate } from "@/components/player-gate";
import { fmt, formatFans, formatLive, formatOnline, getMessages, isLocale, localePath, type Locale } from "@/lib/i18n";
import { getStars, getWatch } from "@/lib/stars";
import { minutesLive, topicOf } from "@/lib/stars-shared";

type Params = Promise<{ locale: string; room: string }>;

const localeOf = (raw: string): Locale => (isLocale(raw) ? raw : "zh-CN");

function parseRoom(s: string): number | null {
  return /^\d{1,12}$/.test(s) ? Number(s) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  const m = getMessages(localeOf(p.locale));
  const room = parseRoom(p.room);
  if (!room) return {};
  const w = await getWatch(room).catch(() => null);
  if (!w) return { title: m.watch.fallbackTitle };
  return {
    title: w.live ? fmt(m.watch.metaLive, { name: w.uname }) : w.uname,
    description: w.live?.title ?? fmt(m.watch.metaOffDescription, { name: w.uname }),
  };
}

export default function WatchPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="aspect-video w-full bg-surface" />}>
      <Watch params={params} />
    </Suspense>
  );
}

async function Watch({ params }: { params: Params }) {
  const p = await params;
  const locale = localeOf(p.locale);
  const m = getMessages(locale);
  const room = parseRoom(p.room);
  if (!room) notFound();
  await connection();
  const w = await getWatch(room).catch(() => null);
  if (!w) notFound();

  const mins = w.live ? minutesLive(w.live.started_at, w.now) : null;
  const roomUrl = `https://live.bilibili.com/${w.room_id}`;
  const spaceUrl = `https://space.bilibili.com/${w.uid}`;

  return (
    <div className="flex flex-col xl:flex-row">
      {/* Theater column */}
      <article className="min-w-0 flex-1">
        <div className="aspect-video w-full bg-black">
          {w.live ? (
            <PlayerGate roomId={w.room_id} name={w.uname} poster={w.live.cover || w.live.keyframe} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400">
              <span>{m.watch.offline}</span>
              <a href={roomUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                {m.watch.goLook}
              </a>
            </div>
          )}
        </div>

        <div className="px-4 pb-8">
          <h1 className="mt-3 text-[17px] font-semibold leading-snug sm:text-lg">{w.live ? w.live.title : fmt(m.watch.roomOf, { name: w.uname })}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {w.live ? (
              <>
                <span className="font-medium text-live">{m.watch.liveNow}</span>
                {mins !== null ? ` · ${fmt(m.units.liveFor, { t: formatLive(mins, m) })}` : ""}
                {w.live.area ? ` · ${m.topics[topicOf(w.live.area)]}` : ""}
                <OnlineCount uid={w.uid} room={w.room_id} />
              </>
            ) : (
              m.watch.notLive
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-y border-line py-4">
            <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Avatar src={w.face} name={w.uname} size={56} />
            </a>
            <div className="min-w-0 flex-1">
              <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-base font-semibold hover:underline">
                {w.uname}
              </a>
              <div className="text-[13px] text-muted">
                {formatFans(w.fans, m, locale)}
                {w.level !== null ? ` · ${fmt(m.units.level, { n: w.level })}` : ""}
                {w.weeks_observed >= 1 ? ` · ${fmt(m.units.weeks, { n: w.weeks_observed })}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FavButton uid={w.uid} name={w.uname} />
              <a href={roomUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90">
                {m.watch.goRoom} <IconExternal className="h-4 w-4" />
              </a>
              <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-3 py-2 text-sm hover:bg-fg/5">
                {m.watch.space}
              </a>
            </div>
          </div>

          <p className="mt-4 text-xs text-faint">
            {m.watch.footnote}
            <Link href={localePath(locale, "/")} className="ml-2 underline">
              {m.watch.back}
            </Link>
          </p>
        </div>
      </article>

      {/* Side rail: other small rooms live right now (Holodex keeps chat here; we have no chat). */}
      <aside className="w-full shrink-0 border-t border-line xl:w-[340px] xl:border-l xl:border-t-0">
        <Suspense fallback={null}>
          <AlsoLive locale={locale} exclude={w.uid} />
        </Suspense>
      </aside>
    </div>
  );
}

async function AlsoLive({ locale, exclude }: { locale: Locale; exclude: number }) {
  const m = getMessages(locale);
  let rows: Awaited<ReturnType<typeof getStars>>["rows"] = [];
  let now = 0;
  try {
    const data = await getStars({ band: "all", online: null, topic: null, q: null, sort: "rank", page: 1, size: 9 });
    rows = data.rows.filter((r) => r.uid !== exclude).slice(0, 8);
    now = data.now;
  } catch {
    return null;
  }
  if (rows.length === 0) return null;
  return (
    <div className="px-4 py-4">
      <h2 className="text-sm font-medium text-muted">{m.watch.alsoLive}</h2>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => {
          const mins = minutesLive(r.started_at, now);
          return (
            <li key={r.uid}>
              <Link href={localePath(locale, `/watch/${r.room_id}`)} className="flex gap-3 rounded-md hover:bg-fg/5">
                <div className="relative w-[128px] shrink-0 overflow-hidden rounded bg-surface" style={{ aspectRatio: "16 / 9" }}>
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                  {mins !== null ? (
                    <span className="absolute bottom-0 right-0 rounded-tl bg-badge px-1 py-0.5 font-mono text-[10px] text-white">
                      {mins < 60 ? fmt(m.units.badgeMinutes, { m: mins }) : `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="clamp-2 text-[13px] font-medium leading-snug">{r.title || r.bili_streamer.uname}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">{r.bili_streamer.uname}</div>
                  <div className="text-xs text-faint">
                    {r.online_count !== null ? formatOnline(r.online_count, m, locale) : ""}
                    {r.online_count !== null && r.weeks_observed >= 1 ? " · " : ""}
                    {r.weeks_observed >= 1 ? fmt(m.units.weeks, { n: r.weeks_observed }) : ""}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={localePath(locale, "/")} className="mt-3 inline-block text-sm text-accent hover:underline">
        {m.watch.more}
      </Link>
    </div>
  );
}
