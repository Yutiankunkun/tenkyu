import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { FavButton } from "@/components/fav-button";
import { OnlineCount } from "@/components/online-count";
import { PlayerGate } from "@/components/player-gate";
import { fmt, formatFans, formatLive, getMessages, isLocale, localePath, type Locale } from "@/lib/i18n";
import { getWatch } from "@/lib/stars";
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
    <main className="mx-auto w-full max-w-6xl px-0 py-0 sm:px-4 sm:py-6">
      <Suspense fallback={<div className="aspect-video w-full bg-fg/5" />}>
        <Watch params={params} />
      </Suspense>
    </main>
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
    <article>
      {/* player: full content width, 16:9, click to play */}
      <div className="aspect-video w-full bg-black sm:overflow-hidden sm:rounded-xl">
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

      <div className="px-4 sm:px-0">
        {/* title row */}
        <div className="mt-4">
          <h1 className="text-lg font-semibold leading-snug sm:text-xl">{w.live ? w.live.title : fmt(m.watch.roomOf, { name: w.uname })}</h1>
          <p className="mt-1 text-sm text-muted">
            {w.live ? (
              <>
                {m.watch.liveNow}
                {mins !== null ? ` · ${fmt(m.units.liveFor, { t: formatLive(mins, m) })}` : ""}
                {w.live.area ? ` · ${m.topics[topicOf(w.live.area)]}` : ""}
                <OnlineCount uid={w.uid} room={w.room_id} />
              </>
            ) : (
              m.watch.notLive
            )}
          </p>
        </div>

        {/* streamer row */}
        <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-line py-4">
          <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Avatar src={w.face} name={w.uname} color="#5b8def" size={56} />
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-base font-semibold hover:underline">
                {w.uname}
              </a>
            </div>
            <div className="text-sm text-muted">
              {formatFans(w.fans, m, locale)}
              {w.level !== null ? ` · ${fmt(m.units.level, { n: w.level })}` : ""}
              {w.weeks_observed >= 1 ? ` · ${fmt(m.units.weeks, { n: w.weeks_observed })}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FavButton uid={w.uid} name={w.uname} />
            <a href={roomUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-fg px-3 py-2 text-sm font-medium text-bg hover:opacity-90">
              {m.watch.goRoom}
            </a>
            <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-3 py-2 text-sm hover:bg-fg/5">
              {m.watch.space}
            </a>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted">
          {m.watch.footnote}
          <Link href={localePath(locale, "/")} className="ml-2 underline">
            {m.watch.back}
          </Link>
        </p>
      </div>
    </article>
  );
}
