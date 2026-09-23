import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { FavButton } from "@/components/fav-button";
import { OnlineCount } from "@/components/online-count";
import { PlayerGate } from "@/components/player-gate";
import { formatFans, formatLive, getWatch, minutesLive, topicOf } from "@/lib/stars";

type Params = Promise<{ room: string }>;

function parseRoom(s: string): number | null {
  return /^\d{1,12}$/.test(s) ? Number(s) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const room = parseRoom((await params).room);
  if (!room) return {};
  const w = await getWatch(room).catch(() => null);
  if (!w) return { title: "观看" };
  return { title: w.live ? `${w.uname} 的直播` : w.uname, description: w.live?.title ?? `${w.uname} 的 B 站直播间` };
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
  const room = parseRoom((await params).room);
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
            <span>现在没有在播</span>
            <a href={roomUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              去直播间看看
            </a>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-0">
        {/* title row */}
        <div className="mt-4">
          <h1 className="text-lg font-semibold leading-snug sm:text-xl">{w.live ? w.live.title : `${w.uname} 的直播间`}</h1>
          <p className="mt-1 text-sm text-muted">
            {w.live ? (
              <>
                直播中
                {mins !== null ? ` · 已播 ${formatLive(mins)}` : ""}
                {w.live.area ? ` · ${topicOf(w.live.area)}` : ""}
                <OnlineCount uid={w.uid} room={w.room_id} />
              </>
            ) : (
              "未在播"
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
              {formatFans(w.fans)}
              {w.level !== null ? ` · 账号 ${w.level} 级` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FavButton uid={w.uid} name={w.uname} />
            <a href={roomUrl} target="_blank" rel="noopener noreferrer" className="rounded-md bg-fg px-3 py-2 text-sm font-medium text-bg hover:opacity-90">
              去直播间
            </a>
            <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-3 py-2 text-sm hover:bg-fg/5">
              B 站主页
            </a>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted">
          官方嵌入播放器，只能看。发弹幕、上舰请去直播间。信息来自 B 站公开接口，约每 10 分钟更新；「在线」是登录用户数，约每分钟更新。
          <Link href="/" className="ml-2 underline">
            回观星台
          </Link>
        </p>
      </div>
    </article>
  );
}
