"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { StreamerPicker } from "@/components/streamer-picker";
import { TimeRange } from "@/components/time-range";
import { TzToggle, useTz } from "@/components/tz-provider";
import { useLocalString } from "@/lib/local-store";
import { PICKS_STORAGE_KEY, parsePicksParam, parseStoredPicks, picksHref, writePicks } from "@/lib/picks";
import { shortMD } from "@/lib/time";
import { dayShiftSuffix, hhmmToMin, minToHHMM, toLocalLabel } from "@/lib/tz";
import type { PublishedSchedule, PublishedStreamer } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/types";

type Props = { streamers: PublishedStreamer[]; today: string };

type Loaded = { status: "loading" } | { status: "ok"; data: PublishedSchedule } | { status: "missing" } | { status: "error" };

type Block = {
  handle: string;
  name: string;
  color: string;
  start: number; // minutes from 00:00 Shanghai
  end: number;
  type: string;
  note: string;
  lane: number;
  lanes: number;
};

const HOUR_PX = 44;
const MIN_HOUR = 6;
const MAX_HOUR = 30;

export function MergedView({ streamers, today }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const allowed = useMemo(() => new Set(streamers.map((s) => s.handle)), [streamers]);
  const byHandle = useMemo(() => new Map(streamers.map((s) => [s.handle, s])), [streamers]);

  // Selection: the URL wins; when it is bare, the browser's stored picks apply.
  const urlParam = sp.get("s");
  const urlPicks = useMemo(() => parsePicksParam(urlParam, allowed), [urlParam, allowed]);
  const storedRaw = useLocalString(PICKS_STORAGE_KEY);
  const storedPicks = useMemo(() => parseStoredPicks(storedRaw, allowed), [storedRaw, allowed]);
  const picks = urlPicks.length ? urlPicks : storedPicks;
  const picksKey = picks.join(",");

  const [week, setWeek] = useState(0);
  const [data, setData] = useState<Record<string, Loaded>>({});
  const inflight = useRef(new Set<string>());

  // Keep localStorage and the URL in step (external systems only; no setState here).
  useEffect(() => {
    if (urlPicks.length) {
      if (urlPicks.join(",") !== storedPicks.join(",")) writePicks(urlPicks);
    } else if (storedPicks.length) {
      router.replace(picksHref(storedPicks), { scroll: false });
    }
  }, [urlPicks, storedPicks, router]);

  function update(next: string[]) {
    writePicks(next);
    router.replace(next.length ? picksHref(next) : pathname, { scroll: false });
  }

  // Fetch published JSON for every pick we don't have yet (setState only in callbacks).
  useEffect(() => {
    for (const h of picksKey ? picksKey.split(",") : []) {
      if (inflight.current.has(h)) continue;
      inflight.current.add(h);
      fetch(`/data/${h}`)
        .then(async (r) => {
          if (r.status === 404) return { status: "missing" } as Loaded;
          if (!r.ok) return { status: "error" } as Loaded;
          return { status: "ok", data: (await r.json()) as PublishedSchedule } as Loaded;
        })
        .catch(() => ({ status: "error" }) as Loaded)
        .then((res) => setData((d) => ({ ...d, [h]: res })));
    }
  }, [picksKey]);

  const loaded = picks.map((h) => ({ handle: h, s: byHandle.get(h), d: data[h] ?? ({ status: "loading" } as Loaded) }));
  const anyOk = loaded.some((x) => x.d?.status === "ok");
  const weekRef = loaded.find((x) => x.d?.status === "ok")?.d as { status: "ok"; data: PublishedSchedule } | undefined;
  const weekMeta = weekRef?.data.weeks[week];

  // Blocks per day (0..6) for the selected week.
  const days: Block[][] = useMemo(() => {
    const out: Block[][] = Array.from({ length: 7 }, () => []);
    for (const x of loaded) {
      if (x.d?.status !== "ok" || !x.s) continue;
      const wk = x.d.data.weeks[week];
      if (!wk) continue;
      wk.days.forEach((day, i) => {
        for (const sl of day.slots) {
          const start = hhmmToMin(sl.start);
          const end = hhmmToMin(sl.end);
          if (start === null || end === null) continue;
          out[i].push({
            handle: x.handle,
            name: x.s!.display_name,
            color: x.s!.theme_color,
            start,
            end,
            type: sl.type,
            note: sl.note,
            lane: 0,
            lanes: 1,
          });
        }
      });
    }
    for (const list of out) packLanes(list);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, picks, week]);

  const allBlocks = days.flat();
  const startHour = allBlocks.length ? clamp(Math.floor(Math.min(...allBlocks.map((b) => b.start)) / 60), MIN_HOUR, MAX_HOUR - 1) : 18;
  const endHour = allBlocks.length ? clamp(Math.ceil(Math.max(...allBlocks.map((b) => b.end)) / 60), startHour + 1, MAX_HOUR) : 26;

  return (
    <div className="space-y-6">
      {/* chips */}
      {picks.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {loaded.map((x) => (
            <span key={x.handle} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2 text-sm">
              {x.s ? <Avatar src={x.s.avatar_url} name={x.s.display_name} color={x.s.theme_color} size={22} /> : null}
              <Link href={`/${x.handle}`} className="hover:underline">
                {x.s?.display_name ?? x.handle}
              </Link>
              {x.d?.status === "missing" || x.d?.status === "error" ? <span className="text-xs text-muted">暂无数据</span> : null}
              <button type="button" aria-label="移除" onClick={() => update(picks.filter((h) => h !== x.handle))} className="text-muted hover:text-fg">
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* controls */}
      {picks.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <button type="button" className="rounded-md border border-line px-2.5 py-1 disabled:opacity-40" disabled={week === 0} onClick={() => setWeek((w) => w - 1)}>
              ←
            </button>
            <span className="font-medium">
              {weekMeta ? `${shortMD(weekMeta.week_start)} – ${shortMD(weekMeta.days[6].date)}` : "本周"}
              {week === 0 ? "（本周）" : ""}
            </span>
            <button type="button" className="rounded-md border border-line px-2.5 py-1 disabled:opacity-40" disabled={week >= 3} onClick={() => setWeek((w) => w + 1)}>
              →
            </button>
          </div>
          <TzToggle />
        </div>
      ) : null}

      {/* grid / list */}
      {picks.length === 0 ? (
        <p className="text-muted">选几个主播，把她们这周的直播放在一张表里。</p>
      ) : !anyOk ? (
        <p className="text-muted">{loaded.every((x) => x.d && x.d.status !== "loading") ? "所选主播暂无日程数据。" : "加载中…"}</p>
      ) : weekMeta ? (
        <>
          <div className="hidden md:block">
            <TimeGrid days={days} week={weekMeta} startHour={startHour} endHour={endHour} today={today} />
          </div>
          <div className="md:hidden">
            <DayList days={days} week={weekMeta} today={today} />
          </div>
        </>
      ) : null}

      {/* picker */}
      <details open={picks.length === 0} className="rounded-xl border border-line">
        <summary className="cursor-pointer px-4 py-3 font-medium">{picks.length ? "调整主播" : "选择主播"}</summary>
        <div className="border-t border-line p-4">
          <StreamerPicker streamers={streamers} picks={picks} onChange={update} />
        </div>
      </details>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Greedy interval packing: overlapping blocks in a day get side-by-side lanes. */
function packLanes(list: Block[]) {
  list.sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnd: number[] = [];
  for (const b of list) {
    let idx = laneEnd.findIndex((e) => e <= b.start);
    if (idx < 0) {
      idx = laneEnd.length;
      laneEnd.push(b.end);
    } else laneEnd[idx] = b.end;
    b.lane = idx;
  }
  // lanes = number of lanes among blocks that overlap this block's time range
  for (const b of list) {
    const overlapping = list.filter((o) => o.start < b.end && o.end > b.start);
    b.lanes = Math.max(...overlapping.map((o) => o.lane)) + 1;
  }
}

function HourLabel({ date, hour }: { date: string; hour: number }) {
  const { tz } = useTz();
  if (tz !== "local") return <>{minToHHMM(hour * 60)}</>;
  const l = toLocalLabel(date, hour * 60);
  return (
    <>
      {l.text}
      <span className="text-[10px]">{dayShiftSuffix(l.dayShift)}</span>
    </>
  );
}

function TimeGrid({
  days,
  week,
  startHour,
  endHour,
  today,
}: {
  days: Block[][];
  week: PublishedSchedule["weeks"][number];
  startHour: number;
  endHour: number;
  today: string;
}) {
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const height = (endHour - startHour) * HOUR_PX;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-bg">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}>
        {/* header */}
        <div className="border-b border-line" />
        {week.days.map((d) => (
          <div key={d.weekday} className={`border-b border-l border-line px-2 py-2 text-center text-sm ${d.date === today ? "font-semibold" : ""}`}>
            {WEEKDAY_LABELS[d.weekday]} <span className="text-xs text-muted">{shortMD(d.date)}</span>
          </div>
        ))}
        {/* time axis */}
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <div key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[11px] tabular-nums text-muted" style={{ top: (h - startHour) * HOUR_PX }}>
              <HourLabel date={week.week_start} hour={h} />
            </div>
          ))}
        </div>
        {/* day columns */}
        {days.map((blocks, i) => (
          <div key={i} className={`relative border-l border-line ${week.days[i].date === today ? "bg-accent/5" : ""}`} style={{ height }}>
            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - startHour) * HOUR_PX }} />
            ))}
            {blocks.map((b, j) => {
              const top = ((b.start - startHour * 60) / 60) * HOUR_PX;
              const h = ((b.end - b.start) / 60) * HOUR_PX;
              const w = 100 / b.lanes;
              return (
                <Link
                  key={j}
                  href={`/${b.handle}`}
                  title={`${b.name} ${minToHHMM(b.start)}–${minToHHMM(b.end)} ${b.type}${b.note ? " · " + b.note : ""}`}
                  className="absolute overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight text-white shadow-sm"
                  style={{ top, height: Math.max(h - 2, 18), left: `calc(${b.lane * w}% + 2px)`, width: `calc(${w}% - 4px)`, backgroundColor: b.color, opacity: 0.92 }}
                >
                  <div className="truncate font-medium">{b.name}</div>
                  {h >= 34 ? <div className="truncate opacity-90">{b.type}</div> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayList({ days, week, today }: { days: Block[][]; week: PublishedSchedule["weeks"][number]; today: string }) {
  return (
    <ol className="space-y-3">
      {week.days.map((d, i) => {
        const blocks = [...days[i]].sort((a, b) => a.start - b.start);
        const isToday = d.date === today;
        return (
          <li key={d.weekday} className="rounded-xl border border-line bg-bg px-4 py-3">
            <div className="mb-1 flex items-baseline gap-2">
              <span className={isToday ? "font-semibold" : "font-medium"}>{WEEKDAY_LABELS[d.weekday]}</span>
              <span className="text-xs text-muted">{shortMD(d.date)}{isToday ? " · 今天" : ""}</span>
            </div>
            {blocks.length === 0 ? (
              <p className="text-sm text-muted">全员定休</p>
            ) : (
              <ul className="space-y-1.5">
                {blocks.map((b, j) => (
                  <li key={j} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-full" style={{ backgroundColor: b.color }} />
                    <TimeRange date={d.date} start={minToHHMM(b.start)} end={minToHHMM(b.end)} />
                    <Link href={`/${b.handle}`} className="font-medium hover:underline">
                      {b.name}
                    </Link>
                    <span className="text-muted">{b.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
