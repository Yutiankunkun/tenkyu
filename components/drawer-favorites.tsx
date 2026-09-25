"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FAVS_KEY, parseFavs } from "@/components/fav-button";
import { localePath } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { useLocalString } from "@/lib/local-store";

type Row = { uid: number; uname: string; face: string; room_id: number | null };

/** Holodex lists your favourites in the drawer; ours come from localStorage + one small API call. */
export function DrawerFavorites({ onNavigate }: { onNavigate: () => void }) {
  const { locale, m } = useI18n();
  const favs = parseFavs(useLocalString(FAVS_KEY));
  const key = favs.slice(0, 12).join(",");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetch(`/api/streamers?uids=${key}`)
      .then((r) => (r.ok ? r.json() : { streamers: [] }))
      .then((j) => {
        if (cancelled) return;
        const byUid = new Map<number, Row>(((j.streamers ?? []) as Row[]).map((s) => [s.uid, s]));
        setRows(favs.map((u) => byUid.get(u)).filter((s): s is Row => Boolean(s)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // favs is derived from `key`; listing it would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="border-t border-line px-2 py-2">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-faint">
        <span>{m.drawer.favorites}</span>
      </div>
      {favs.length === 0 ? (
        <p className="px-3 py-1 text-xs text-faint">{m.drawer.noFavs}</p>
      ) : (
        <ul>
          {rows.map((s) => (
            <li key={s.uid}>
              <Link
                href={s.room_id ? localePath(locale, `/watch/${s.room_id}`) : localePath(locale, "/favorites")}
                onClick={onNavigate}
                className="flex h-9 items-center gap-3 rounded-md px-3 text-[13px] text-fg/90 hover:bg-fg/5"
              >
                <Avatar src={s.face} name={s.uname} size={24} />
                <span className="truncate">{s.uname}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={localePath(locale, "/favorites")} onClick={onNavigate} className="mt-1 block px-3 py-1 text-xs text-accent hover:underline">
        {m.drawer.manage}
      </Link>
    </div>
  );
}
