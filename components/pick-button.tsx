"use client";

import { useLocalString } from "@/lib/local-store";
import { PICKS_STORAGE_KEY, parseStoredPicks, writePicks } from "@/lib/picks";
import { MAX_PICKS } from "@/lib/types";

/** Home-card toggle: add/remove a streamer from the browser's merged-view picks. */
export function PickButton({ handle }: { handle: string }) {
  const picks = parseStoredPicks(useLocalString(PICKS_STORAGE_KEY));
  const on = picks.includes(handle);
  const full = picks.length >= MAX_PICKS;

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = on ? picks.filter((h) => h !== handle) : full ? picks : [...picks, handle];
    writePicks(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!on && full}
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs ${
        on ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg"
      }`}
      aria-pressed={on}
    >
      {on ? "已加入合并" : "加入合并"}
    </button>
  );
}
