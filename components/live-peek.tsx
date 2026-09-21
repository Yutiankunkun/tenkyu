"use client";

import { useEffect, useState } from "react";

type Props = { roomId: number; name: string; title: string; className?: string };

/**
 * 「看一眼」: opens Bilibili's official embed player (live-activity-player) in a modal.
 * One at a time, closes on Esc / backdrop. Sanctioned embed — no stream-URL pulling.
 * The player has its own controls; danmaku sending etc. still need the real room.
 */
export function LivePeek({ roomId, name, title, className }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        看一眼
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-bg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{name}</div>
                <div className="truncate text-xs text-muted">{title}</div>
              </div>
              <a
                href={`https://live.bilibili.com/${roomId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:opacity-90"
              >
                去直播间
              </a>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭" className="shrink-0 rounded-md px-2 py-1 text-muted hover:text-fg">
                ✕
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=${roomId}&quality=0`}
                title={`${name} 的直播`}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="px-4 py-2 text-xs text-muted">官方嵌入播放器，只能看。发弹幕、上舰请去直播间。</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
