"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

type Props = { roomId: number; name: string; poster: string };

/**
 * Click-to-play: the official Bilibili embed is only mounted after the viewer presses ▶.
 * With Cache Components, a route you navigate away from stays mounted (hidden) for
 * instant back-navigation — so the player must unmount itself when its effects are
 * cleaned up, or the audio keeps playing on the next page.
 */
export function PlayerGate({ roomId, name, poster }: Props) {
  const { m } = useI18n();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    return () => setPlaying(false); // route hidden / unmounted → stop the stream
  }, [playing]);

  if (playing) {
    return (
      <iframe
        src={`https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=${roomId}&quality=0`}
        title={fmt(m.player.iframeTitle, { name })}
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
      aria-label={fmt(m.player.play, { name })}
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
      <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">{m.player.hint}</span>
    </button>
  );
}
