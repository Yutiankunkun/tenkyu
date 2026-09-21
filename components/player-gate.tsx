"use client";

import { useState } from "react";

type Props = { roomId: number; name: string; poster: string };

/** Click-to-play: the official Bilibili embed is only mounted after the viewer presses ▶. */
export function PlayerGate({ roomId, name, poster }: Props) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <iframe
        src={`https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=${roomId}&quality=0`}
        title={`${name} 的直播`}
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block h-full w-full overflow-hidden text-left"
      aria-label={`播放 ${name} 的直播`}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : null}
      <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-2xl text-black shadow-lg sm:h-20 sm:w-20 sm:text-3xl">
          ▶
        </span>
      </span>
      <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">点击播放 · 官方播放器</span>
    </button>
  );
}
