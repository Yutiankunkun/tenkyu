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
    <Suspense fallback={<p className="px-4 py-6 text-muted">{m.board.loading}</p>}>
      <Board locale={locale} searchParams={searchParams} />
    </Suspense>
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
    return <p className="px-4 py-6 text-muted">{m.board.unavailable}</p>;
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
  const oc = data.onlineCounts;
  const tab = (on: boolean) =>
    `relative flex h-12 shrink-0 items-center gap-1.5 px-3 text-[13px] uppercase tracking-wide ${on ? "text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent" : "text-muted hover:text-fg"}`;
  const count = (n: number | undefined) =>
    n === undefined ? null : <span className="rounded-full bg-fg/10 px-1.5 text-[11px] font-medium leading-5">{n}</span>;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-[13px] ${on ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:text-fg"}`;

  return (
    <div>
      {/* Tabs row (online bands), Holodex-style, sticky under the app bar. */}
      <div className="sticky top-14 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center overflow-x-auto px-2">
          <Link href={href({ online: null })} className={tab(query.online === null)}>
            {m.board.all} {count(oc ? oc.le10 + oc.b11_30 + oc.b31_50 + oc.gt50 + oc.unknown : undefined)}
          </Link>
          {ONLINE_BANDS.map((b) => (
            <Link key={b} href={href({ online: b })} className={tab(query.online === b)}>
              {m.board.onlineBands[b]} {count(oc ? oc[ONLINE_COUNT_KEY[b]] : undefined)}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Secondary filters: sort, followers, topic. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-faint">{m.board.sortLabel}</span>
            {SORTS.map((s) => (
              <Link key={s} href={href({ sort: s })} className={chip(query.sort === s)}>
                {m.board.sort[s]}
              </Link>
            ))}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-faint">{m.board.fansLabel}</span>
            {(["all", "small", "new"] as Band[]).map((b) => (
              <Link key={b} href={href({ band: b })} className={chip(query.band === b)}>
                {fmt(m.board.fansBands[b], { n: BAND_LIMIT.new ?? 0 })}
              </Link>
            ))}
          </span>
          {data.topics.length > 1 ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-faint">{m.board.topicLabel}</span>
              <Link href={href({ topic: null })} className={chip(query.topic === null)}>
                {m.board.all}
              </Link>
              {data.topics.map(({ topic, n }) => (
                <Link key={topic} href={href({ topic })} className={chip(query.topic === topic)}>
                  {m.topics[topic]} <span className="opacity-60">{n}</span>
                </Link>
              ))}
            </span>
          ) : null}
        </div>

        {query.q ? (
          <p className="mt-3 text-sm text-muted">
            {fmt(m.board.results, { q: query.q })}
            <Link href={href({ q: null })} className="ml-2 underline">
              {m.board.clear}
            </Link>
          </p>
        ) : null}
        {oc && oc.unknown > 0 && query.online !== null ? <p className="mt-2 text-xs text-faint">{fmt(m.board.unknownOnline, { n: oc.unknown })}</p> : null}

        <div className="mt-4">
          <StarsGrid rows={data.rows} total={data.total} page={data.page} pages={data.pages} pageBase={href({ page: 1 })} now={data.now} updatedAt={data.updatedAt} />
        </div>

        <p className="mt-10 text-xs text-faint">
          {fmt(m.board.intro, { gate: LEVEL_GATE })}
          <Link href={localePath(locale, "/about")} className="ml-2 underline">
            {m.board.how}
          </Link>
          <Link href={localePath(locale, "/check")} className="ml-2 underline">
            {m.board.checkMe}
          </Link>
        </p>
      </div>
    </div>
  );
}
