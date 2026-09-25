"use client";

import { useEffect, useState } from "react";
import { formatOnline } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/**
 * Online count for a live room: logged-in viewers from Bilibili's contribution-rank count,
 * refreshed every minute while the page is visible. Renders nothing until the first answer,
 * and nothing at all if the endpoint is unavailable — the page must never depend on it.
 */
export function OnlineCount({ uid, room }: { uid: number; room: number }) {
  const { locale, m } = useI18n();
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
  return <span title={m.watch.onlineTitle}>{` · ${formatOnline(online, m, locale)}`}</span>;
}
