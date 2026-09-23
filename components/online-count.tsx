"use client";

import { useEffect, useState } from "react";

/**
 * Online count for a live room: logged-in viewers from Bilibili's contribution-rank count, refreshed every
 * minute while the page is visible. Renders nothing until the first answer, and nothing at
 * all if the endpoint is unavailable — the page must never depend on it.
 */
export function OnlineCount({ uid, room }: { uid: number; room: number }) {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const res = await fetch(`/api/online?uid=${uid}&room=${room}`);
        const j = res.ok ? ((await res.json()) as { online: number | null }) : { online: null };
        if (!cancelled) setOnline(j.online);
      } catch {
        if (!cancelled) setOnline(null);
      }
      if (!cancelled) timer = setTimeout(load, 60_000);
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void load();
      } else {
        clearTimeout(timer);
      }
    }
    void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [uid, room]);

  if (online === null) return null;
  return (
    <span title="登录用户在线数，来自 B 站高能榜；游客不计入。约每分钟更新。">
      {" · 在线 "}
      {online.toLocaleString("zh-CN")}
    </span>
  );
}
