import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StarsGrid } from "@/components/stars-grid";
import { BAND_LIMIT, LEVEL_GATE, getClaimed, getStars, type Band } from "@/lib/stars";

export const metadata = {
  title: "观星台",
  description: "现在在播的小体量 VTuber。只收账号等级 3 级以上的主播。",
};

type SP = Promise<{ band?: string; area?: string }>;

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

  let data: Awaited<ReturnType<typeof getStars>>;
  let claimed: Awaited<ReturnType<typeof getClaimed>>;
  try {
    [data, claimed] = await Promise.all([getStars(band, area), getClaimed()]);
  } catch {
    return <p className="text-muted">观星台暂时无法加载。</p>;
  }
  const href = (next: Partial<{ band: Band; area: string | null }>) => {
    const q = new URLSearchParams();
    const b = next.band ?? band;
    const a = next.area === undefined ? area : next.area;
    if (b !== "small") q.set("band", b);
    if (a) q.set("area", a);
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

      <StarsGrid rows={data.rows} claimed={[...claimed.entries()]} now={data.now} updatedAt={data.updatedAt} />
    </div>
  );
}
