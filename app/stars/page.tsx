import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { BAND_LIMIT, LEVEL_GATE, formatFans, getClaimed, getStars, minutesLive, type Band } from "@/lib/stars";

export const metadata = {
  title: "观星台",
  description: "现在在播的小体量 VTuber。只收账号等级 3 级以上的主播。",
};

type SP = Promise<{ band?: string; area?: string; p?: string }>;
const PAGE = 60;

export default function StarsPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">观星台</h1>
          <p className="mt-1 text-sm text-muted">
            现在在播的小体量 VTuber。只收账号等级 {LEVEL_GATE} 级以上的主播，约每 10 分钟更新。
            <Link href="/stars/about" className="ml-2 underline">
              我们怎么选
            </Link>
          </p>
        </div>
      </header>
      <div className="mt-6">
        <Suspense fallback={<p className="text-muted">加载中…</p>}>
          <Board searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

function parseBand(v: string | undefined): Band {
  return v === "new" || v === "all" ? v : "small";
}

async function Board({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const band = parseBand(sp.band);
  const area = sp.area || null;
  const page = Math.max(1, Number(sp.p ?? 1) || 1);

  let data: Awaited<ReturnType<typeof getStars>>;
  let claimed: Awaited<ReturnType<typeof getClaimed>>;
  try {
    [data, claimed] = await Promise.all([getStars(band, area), getClaimed()]);
  } catch {
    return <p className="text-muted">观星台暂时无法加载。</p>;
  }
  const now = data.now;
  const total = data.rows.length;
  const rows = data.rows.slice((page - 1) * PAGE, page * PAGE);
  const href = (next: Partial<{ band: Band; area: string | null; p: number }>) => {
    const q = new URLSearchParams();
    const b = next.band ?? band;
    const a = next.area === undefined ? area : next.area;
    const p = next.p ?? 1;
    if (b !== "small") q.set("band", b);
    if (a) q.set("area", a);
    if (p > 1) q.set("p", String(p));
    const s = q.toString();
    return s ? `/stars?${s}` : "/stars";
  };
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["new", `新人 < ${BAND_LIMIT.new}`],
            ["small", "小体量 < 1 万"],
            ["all", "全部"],
          ] as [Band, string][]
        ).map(([b, label]) => (
          <Link key={b} href={href({ band: b })} className={chip(band === b)}>
            {label}
          </Link>
        ))}
        {data.areas.length > 1 ? <span className="mx-1 text-line">|</span> : null}
        {data.areas.length > 1
          ? [null, ...data.areas].map((a) => (
              <Link key={a ?? "_all"} href={href({ area: a })} className={chip(area === a)}>
                {a ?? "全部分区"}
              </Link>
            ))
          : null}
      </div>

      <p className="text-xs text-muted">
        {total} 位在播
        {data.updatedAt ? ` · 更新于 ${new Date(data.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" })}（北京时间）` : ""}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted">{data.updatedAt ? "这个筛选下现在没有人在播。" : "暂无数据，采集器可能还没跑起来。"}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const handle = claimed.get(r.uid);
            const mins = minutesLive(r.started_at, now);
            return (
              <li key={r.uid} className="overflow-hidden rounded-xl border border-line bg-bg">
                <Link href={`/watch/${r.room_id}`} className="block">
                  <div className="aspect-video bg-fg/5">
                    {r.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </Link>
                <div className="flex gap-3 p-3">
                  <Avatar src={r.bili_streamer.face} name={r.bili_streamer.uname} color="#5b8def" size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.bili_streamer.uname}</span>
                      {handle ? (
                        <Link href={`/${handle}`} className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                          已入驻
                        </Link>
                      ) : null}
                    </div>
                    <div className="truncate text-sm text-fg/80">{r.title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                      {r.area ? <span>{r.area}</span> : null}
                      <span>{formatFans(r.bili_streamer.fans)}</span>
                      {mins !== null ? <span>已播 {mins >= 60 ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分` : `${mins} 分`}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs">
                  <span className="flex items-center gap-3">
                    <Link href={`/watch/${r.room_id}`} className="font-medium text-accent hover:underline">
                      在天球看
                    </Link>
                    <a href={`https://live.bilibili.com/${r.room_id}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
                      去直播间 →
                    </a>
                  </span>
                  {handle ? (
                    <Link href={`/${handle}`} className="text-muted hover:text-fg">
                      看她的日程
                    </Link>
                  ) : (
                    <Link href="/apply" className="text-muted hover:text-fg">
                      这是你？申请入驻
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE ? (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={href({ p: page - 1 })} className="text-muted hover:text-fg">
              ← 上一页
            </Link>
          ) : null}
          <span className="text-muted">
            {page} / {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total ? (
            <Link href={href({ p: page + 1 })} className="text-muted hover:text-fg">
              下一页 →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
