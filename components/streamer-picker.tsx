"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import type { PublishedStreamer } from "@/lib/types";
import { MAX_PICKS } from "@/lib/types";

type Props = {
  streamers: PublishedStreamer[];
  picks: string[];
  onChange: (next: string[]) => void;
};

export function StreamerPicker({ streamers, picks, onChange }: Props) {
  const [q, setQ] = useState("");
  const shown = q
    ? streamers.filter((s) => s.display_name.toLowerCase().includes(q.toLowerCase()) || s.handle.includes(q.toLowerCase()))
    : streamers;
  const full = picks.length >= MAX_PICKS;

  function toggle(handle: string) {
    if (picks.includes(handle)) onChange(picks.filter((h) => h !== handle));
    else if (!full) onChange([...picks, handle]);
  }

  return (
    <div className="space-y-3">
      {streamers.length > 8 ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索主播"
          className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
        />
      ) : null}
      {shown.length === 0 ? <p className="text-sm text-muted">没有主播。</p> : null}
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((s) => {
          const on = picks.includes(s.handle);
          return (
            <li key={s.handle}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                  on ? "border-accent bg-accent/5" : "border-line hover:bg-fg/5"
                } ${!on && full ? "opacity-50" : ""}`}
              >
                <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(s.handle)} className="accent-accent" />
                <Avatar src={s.avatar_url} name={s.display_name} color={s.theme_color} size={32} />
                <span className="min-w-0 truncate">{s.display_name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {full ? <p className="text-xs text-muted">最多选 {MAX_PICKS} 位。</p> : null}
    </div>
  );
}
