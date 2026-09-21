"use client";

import { useLocalString, writeLocal } from "@/lib/local-store";

export const FAVS_KEY = "tenkyu:favs";

export function parseFavs(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)).slice(0, 200) : [];
  } catch {
    return [];
  }
}

/** ♡ stored in this browser only (uid list). No account, nothing uploaded. */
export function FavButton({ uid, name }: { uid: number; name: string }) {
  const favs = parseFavs(useLocalString(FAVS_KEY));
  const on = favs.includes(uid);
  function toggle() {
    const next = on ? favs.filter((u) => u !== uid) : [...favs, uid];
    writeLocal(FAVS_KEY, JSON.stringify(next));
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? `取消收藏 ${name}` : `收藏 ${name}`}
      title={on ? "已收藏（仅保存在这个浏览器）" : "收藏（仅保存在这个浏览器）"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg leading-none ${
        on ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg"
      }`}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}
