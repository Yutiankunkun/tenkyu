"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { FavButton } from "@/components/fav-button";
import { fmt, formatFans, formatOnline, localePath, weeksLabel } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { useOpenOnBilibili } from "@/lib/prefs";
import { minutesLive, topicOf, type StarRow } from "@/lib/stars-shared";

/** Compact elapsed-time badge like Holodex's duration: "1:23" or "45 分" / "45m". */
function badge(mins: number, minutesTemplate: string): string {
  if (mins < 60) return fmt(minutesTemplate, { m: mins });
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

/**
 * One room, Holodex card anatomy: 16:9 cover (never the keyframe) with topic chip (top-left),
 * ♡ (top-right), elapsed badge (bottom-right); below it avatar, two-line title, streamer,
 * status line. With the "open on Bilibili" setting the card links straight to the room.
 */
export function StarCard({ r, now }: { r: StarRow; now: number }) {
  const { locale, m } = useI18n();
  const external = useOpenOnBilibili();
  const href = external ? `https://live.bilibili.com/${r.room_id}` : localePath(locale, `/watch/${r.room_id}`);
  const linkProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  const mins = minutesLive(r.started_at, now);
  const weeks = weeksLabel(r.weeks_observed, m);
  return (
    <article className="group flex flex-col">
      <div className="relative aspect-video overflow-hidden rounded bg-surface">
        <Link href={href} {...linkProps} className="absolute inset-0" aria-label={r.title}>
          {r.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
          ) : null}
        </Link>
        <span className="pointer-events-none absolute left-0 top-0 rounded-br bg-chip px-1.5 py-0.5 text-[11px] text-white">{m.topics[topicOf(r.area)]}</span>
        <span className="absolute right-1 top-1 opacity-80 transition-opacity group-hover:opacity-100">
          <FavButton uid={r.uid} name={r.bili_streamer.uname} size="sm" />
        </span>
        {mins !== null ? (
          <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl bg-badge px-1.5 py-0.5 font-mono text-[12px] text-white">{badge(mins, m.units.badgeMinutes)}</span>
        ) : null}
      </div>
      <div className="flex gap-3 pt-2">
        <Link href={href} {...linkProps} className="shrink-0 pt-0.5">
          <Avatar src={r.bili_streamer.face} name={r.bili_streamer.uname} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={href} {...linkProps} className="clamp-2 text-[14px] font-medium leading-snug text-fg hover:underline">
            {r.title || r.bili_streamer.uname}
          </Link>
          <div className="mt-0.5 truncate text-[13px] text-muted">
            {r.bili_streamer.uname}
            <span className="text-faint"> · {formatFans(r.bili_streamer.fans, m, locale)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px]">
            <span className="font-medium text-live">{m.grid.live}</span>
            {r.online_count !== null ? <span className="text-muted">• {formatOnline(r.online_count, m, locale)}</span> : null}
            {weeks ? <span className="text-faint">• {weeks}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
