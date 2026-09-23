import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StarsGrid } from "@/components/stars-grid";
import {
  BAND_LIMIT,
  DEFAULT_SORT,
  LEVEL_GATE,
  ONLINE_BANDS,
  ONLINE_COUNT_KEY,
  ONLINE_LABEL,
  SORT_LABEL,
  TOPICS,
  getStars,
  type Band,
  type OnlineBand,
  type Sort,
  type Topic,
} from "@/lib/stars";

export const metadata = {
  title: "观星台",
  description: "现在在播的小体量 VTuber。只收账号等级 3 级以上的主播。",
};

type SP = Promise<{ band?: string; o?: string; topic?: string; q?: string; sort?: string; p?: string }>;

export default function StarsPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">观星台</h1>
          <p className="mt-1 text-sm text-muted">
            现在在播的小体量 VTuber。只收账号等级 {LEVEL_GATE} 级以上的主播，约每 10 分钟更新。
            <Link href="/about" className="ml-2 underline">
              我们怎么选
            </Link>
            <Link href="/check" className="ml-2 underline">
              查一查我在不在
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

const parseBand = (v: string | undefined): Band => (v === "new" || v === "small" ? v : "all");
const parseOnline = (v: string | undefined): OnlineBand | null => ((ONLINE_BANDS as readonly string[]).includes(v ?? "") ? (v as OnlineBand) : null);
const parseSort = (v: string | undefined): Sort => (v === "online" || v === "small" || v === "new" ? v : DEFAULT_SORT);
const parseTopic = (v: string | undefined): Topic | null => ((TOPICS as readonly string[]).includes(v ?? "") ? (v as Topic) : null);
const clean = (v: string | undefined, max: number) => (v ? v.trim().slice(0, max) : "") || null;

async function Board({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const query = {
    band: parseBand(sp.band),
    online: parseOnline(sp.o),
    topic: parseTopic(sp.topic),
    q: clean(sp.q, 40),
    sort: parseSort(sp.sort),
    page: Number(sp.p ?? 1) || 1,
  };

  let data: Awaited<ReturnType<typeof getStars>>;
  try {
    data = await getStars(query);
  } catch {
    return <p className="text-muted">观星台暂时无法加载。</p>;
  }

  const href = (next: Partial<typeof query>) => {
    const n = { ...query, page: 1, ...next };
    const p = new URLSearchParams();
    if (n.online) p.set("o", n.online);
    if (n.band !== "all") p.set("band", n.band);
    if (n.topic) p.set("topic", n.topic);
    if (n.q) p.set("q", n.q);
    if (n.sort !== DEFAULT_SORT) p.set("sort", n.sort);
    if (n.page > 1) p.set("p", String(n.page));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`;
  const oc = data.onlineCounts;

  return (
    <div className="space-y-4">
      <form action="/" method="get" className="flex gap-2">
        {query.online ? <input type="hidden" name="o" value={query.online} /> : null}
        {query.band !== "all" ? <input type="hidden" name="band" value={query.band} /> : null}
        {query.sort !== DEFAULT_SORT ? <input type="hidden" name="sort" value={query.sort} /> : null}
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="搜主播或标题"
          maxLength={40}
          className="w-full max-w-md rounded-md border border-line bg-bg px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-fg/5">搜索</button>
        {query.q || query.topic ? (
          <Link href={href({ q: null, topic: null })} className="self-center text-sm text-muted hover:text-fg">
            清除
          </Link>
        ) : null}
      </form>

      {/* Discovery axis: bands of the logged-in viewer count. */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ online: null })} className={chip(query.online === null)}>
          全部
        </Link>
        {ONLINE_BANDS.map((b) => (
          <Link key={b} href={href({ online: b })} className={chip(query.online === b)}>
            {ONLINE_LABEL[b]} {oc ? <span className="opacity-60">{oc[ONLINE_COUNT_KEY[b]]}</span> : null}
          </Link>
        ))}
        {oc && oc.unknown > 0 ? <span className="text-xs text-muted">{oc.unknown} 间还没取到在线数</span> : null}
      </div>

      {/* Secondary: fans band and order. */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "粉丝不限"],
            ["small", "粉丝 < 1 万"],
            ["new", `粉丝 < ${BAND_LIMIT.new}`],
          ] as [Band, string][]
        ).map(([b, label]) => (
          <Link key={b} href={href({ band: b })} className={chip(query.band === b)}>
            {label}
          </Link>
        ))}
        <span className="mx-1 text-line">|</span>
        {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
          <Link key={s} href={href({ sort: s })} className={chip(query.sort === s)}>
            {SORT_LABEL[s]}
          </Link>
        ))}
      </div>

      {data.topics.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href({ topic: null })} className={chip(query.topic === null)}>
            全部
          </Link>
          {data.topics.map(({ topic, n }) => (
            <Link key={topic} href={href({ topic })} className={chip(query.topic === topic)}>
              {topic} <span className="opacity-60">{n}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <StarsGrid
        rows={data.rows}
        total={data.total}
        page={data.page}
        pages={data.pages}
        pageBase={href({ page: 1 })}
        now={data.now}
        updatedAt={data.updatedAt}
      />
    </div>
  );
}
