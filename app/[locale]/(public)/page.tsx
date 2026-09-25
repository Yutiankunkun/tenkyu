import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StarsGrid } from "@/components/stars-grid";
import { fmt, getMessages, isLocale, localePath, type Locale } from "@/lib/i18n";
import { getStars } from "@/lib/stars";
import {
  BAND_LIMIT,
  DEFAULT_SORT,
  LEVEL_GATE,
  ONLINE_BANDS,
  ONLINE_COUNT_KEY,
  SORTS,
  TOPIC_KEYS,
  type Band,
  type OnlineBand,
  type Sort,
  type TopicKey,
} from "@/lib/stars-shared";

type Params = Promise<{ locale: string }>;
type SP = Promise<{ band?: string; o?: string; topic?: string; q?: string; sort?: string; p?: string }>;

const localeOf = (raw: string): Locale => (isLocale(raw) ? raw : "zh-CN");

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const m = getMessages(localeOf((await params).locale));
  return { title: m.board.title, description: fmt(m.board.metaDescription, { gate: LEVEL_GATE }) };
}

export default async function StarsPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const locale = localeOf((await params).locale);
  const m = getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{m.board.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {fmt(m.board.intro, { gate: LEVEL_GATE })}
            <Link href={localePath(locale, "/about")} className="ml-2 underline">
              {m.board.how}
            </Link>
            <Link href={localePath(locale, "/check")} className="ml-2 underline">
              {m.board.checkMe}
            </Link>
          </p>
        </div>
      </header>
      <div className="mt-6">
        <Suspense fallback={<p className="text-muted">{m.board.loading}</p>}>
          <Board locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

const parseBand = (v: string | undefined): Band => (v === "new" || v === "small" ? v : "all");
const parseOnline = (v: string | undefined): OnlineBand | null => ((ONLINE_BANDS as readonly string[]).includes(v ?? "") ? (v as OnlineBand) : null);
const parseSort = (v: string | undefined): Sort => ((SORTS as readonly string[]).includes(v ?? "") ? (v as Sort) : DEFAULT_SORT);
const parseTopic = (v: string | undefined): TopicKey | null => ((TOPIC_KEYS as readonly string[]).includes(v ?? "") ? (v as TopicKey) : null);
const clean = (v: string | undefined, max: number) => (v ? v.trim().slice(0, max) : "") || null;

async function Board({ locale, searchParams }: { locale: Locale; searchParams: SP }) {
  await connection();
  const m = getMessages(locale);
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
    return <p className="text-muted">{m.board.unavailable}</p>;
  }

  const base = localePath(locale, "/");
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
    return s ? `${base}?${s}` : base;
  };
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"}`;
  const oc = data.onlineCounts;

  return (
    <div className="space-y-4">
      <form action={base} method="get" className="flex gap-2">
        {query.online ? <input type="hidden" name="o" value={query.online} /> : null}
        {query.band !== "all" ? <input type="hidden" name="band" value={query.band} /> : null}
        {query.sort !== DEFAULT_SORT ? <input type="hidden" name="sort" value={query.sort} /> : null}
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder={m.board.searchPlaceholder}
          maxLength={40}
          className="w-full max-w-md rounded-md border border-line bg-bg px-3 py-2 text-sm"
        />
        <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-fg/5">{m.board.search}</button>
        {query.q || query.topic ? (
          <Link href={href({ q: null, topic: null })} className="self-center text-sm text-muted hover:text-fg">
            {m.board.clear}
          </Link>
        ) : null}
      </form>

      {/* Discovery axis: bands of the logged-in viewer count. */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ online: null })} className={chip(query.online === null)}>
          {m.board.all}
        </Link>
        {ONLINE_BANDS.map((b) => (
          <Link key={b} href={href({ online: b })} className={chip(query.online === b)}>
            {m.board.onlineBands[b]} {oc ? <span className="opacity-60">{oc[ONLINE_COUNT_KEY[b]]}</span> : null}
          </Link>
        ))}
        {oc && oc.unknown > 0 ? <span className="text-xs text-muted">{fmt(m.board.unknownOnline, { n: oc.unknown })}</span> : null}
      </div>

      {/* Secondary: fans band and order. */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "small", "new"] as Band[]).map((b) => (
          <Link key={b} href={href({ band: b })} className={chip(query.band === b)}>
            {fmt(m.board.fansBands[b], { n: BAND_LIMIT.new ?? 0 })}
          </Link>
        ))}
        <span className="mx-1 text-line">|</span>
        {SORTS.map((s) => (
          <Link key={s} href={href({ sort: s })} className={chip(query.sort === s)}>
            {m.board.sort[s]}
          </Link>
        ))}
      </div>

      {data.topics.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href({ topic: null })} className={chip(query.topic === null)}>
            {m.board.all}
          </Link>
          {data.topics.map(({ topic, n }) => (
            <Link key={topic} href={href({ topic })} className={chip(query.topic === topic)}>
              {m.topics[topic]} <span className="opacity-60">{n}</span>
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
