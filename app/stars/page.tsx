import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StarsGrid } from "@/components/stars-grid";
import { BAND_LIMIT, LEVEL_GATE, SORT_LABEL, getClaimed, getStars, type Band, type Sort } from "@/lib/stars";

export const metadata = {
  title: "观星台",
  description: "现在在播的小体量 VTuber。只收账号等级 3 级以上的主播。",
};

type SP = Promise<{ band?: string; area?: string; tag?: string; q?: string; sort?: string }>;

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

const parseBand = (v: string | undefined): Band => (v === "new" || v === "all" ? v : "small");
const parseSort = (v: string | undefined): Sort => (v === "hot" || v === "small" ? v : "new");
const clean = (v: string | undefined, max: number) => (v ? v.trim().slice(0, max) : "") || null;

async function Board({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const query = { band: parseBand(sp.band), area: clean(sp.area, 20), tag: clean(sp.tag, 20), q: clean(sp.q, 40), sort: parseSort(sp.sort) };

  let data: Awaited<ReturnType<typeof getStars>>;
  let claimed: Awaited<ReturnType<typeof getClaimed>>;
  try {
    [data, claimed] = await Promise.all([getStars(query), getClaimed()]);
  } catch {
    return <p className="text-muted">观星台暂时无法加载。</p>;
  }

  const href = (next: Partial<typeof query>) => {
    const n = { ...query, ...next };
    const p = new URLSearchParams();
    if (n.band !== "small") p.set("band", n.band);
    if (n.area) p.set("area", n.area);
    if (n.tag) p.set("tag", n.tag);
    if (n.q) p.set("q", n.q);
    if (n.sort !== "new") p.set("sort", n.sort);
    const s = p.toString();
    return s ? `/stars?${s}` : "/stars";
  };
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`;

  return (
    <div className="space-y-4">
      {/* search */}
      <form action="/stars" method="get" className="flex gap-2">
        {query.band !== "small" ? <input type="hidden" name="band" value={query.band} /> : null}
        {query.sort !== "new" ? <input type="hidden" name="sort" value={query.sort} /> : null}
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="搜主播、标题或标签"
          maxLength={40}
          className="w-full max-w-md rounded-md border border-line bg-bg px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-fg/5">搜索</button>
        {query.q || query.tag || query.area ? (
          <Link href={href({ q: null, tag: null, area: null })} className="self-center text-sm text-muted hover:text-fg">
            清除
          </Link>
        ) : null}
      </form>

      {/* band + sort */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["new", `新人 < ${BAND_LIMIT.new}`],
            ["small", "小体量 < 1 万"],
            ["all", "全部"],
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

      {/* area */}
      {data.areas.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          {[null, ...data.areas].map((a) => (
            <Link key={a ?? "_all"} href={href({ area: a })} className={chip(query.area === a)}>
              {a ?? "全部分区"}
            </Link>
          ))}
        </div>
      ) : null}

      {/* tags */}
      {data.topTags.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">标签</span>
          {data.topTags.map((t) => (
            <Link
              key={t}
              href={href({ tag: query.tag === t ? null : t })}
              className={`rounded-full border px-2 py-0.5 text-xs ${query.tag === t ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      ) : null}

      <StarsGrid rows={data.rows} claimed={[...claimed.entries()]} now={data.now} updatedAt={data.updatedAt} />
    </div>
  );
}
