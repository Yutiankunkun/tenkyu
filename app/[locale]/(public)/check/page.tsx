import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { fmt, formatDay, formatFans, formatLive, getMessages, isLocale, localePath, type Locale, type Messages } from "@/lib/i18n";
import { REMOVAL_FORM_URL, REMOVAL_ISSUE_URL } from "@/lib/site";
import { getCheck, type CheckResult } from "@/lib/stars";
import { LEVEL_GATE, minutesLive, topicOf } from "@/lib/stars-shared";

type Params = Promise<{ locale: string }>;
type SP = Promise<{ q?: string | string[] }>;

const localeOf = (raw: string): Locale => (isLocale(raw) ? raw : "zh-CN");
const removalHref = REMOVAL_FORM_URL ?? REMOVAL_ISSUE_URL;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: getMessages(localeOf((await params).locale)).check.metaTitle };
}

export default async function CheckPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const locale = localeOf((await params).locale);
  const m = getMessages(locale);
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">{m.check.title}</h1>
      <p className="mt-3 leading-7 text-fg/85">{m.check.intro}</p>
      <form method="get" className="mt-6 flex gap-2">
        <input
          type="text"
          name="q"
          inputMode="numeric"
          placeholder={m.check.placeholder}
          className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 text-base"
          autoComplete="off"
        />
        <button type="submit" className="shrink-0 rounded-md bg-fg px-4 py-2 text-bg hover:opacity-90">
          {m.check.submit}
        </button>
      </form>
      <Suspense fallback={<p className="mt-6 text-sm text-muted">{m.check.loading}</p>}>
        <Result locale={locale} searchParams={searchParams} />
      </Suspense>
      <section className="mt-12 space-y-3 border-t border-line pt-6 text-sm leading-6 text-fg/85">
        <h2 className="text-base font-semibold">{m.check.removalTitle}</h2>
        <p>
          {m.check.removalText1}
          <a href={removalHref} target="_blank" rel="noopener noreferrer" className="underline">
            {m.check.removalLink}
          </a>
          {m.check.removalText2}
        </p>
        <p className="text-muted">
          {m.check.rulesText}
          <Link href={localePath(locale, "/about")} className="underline">
            {m.check.rulesLink}
          </Link>
          {m.check.period}
        </p>
      </section>
    </main>
  );
}

async function Result({ locale, searchParams }: { locale: Locale; searchParams: SP }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  if (!raw || !raw.trim()) return null;
  await connection();
  const r = await getCheck(raw);
  return (
    <div className="mt-6">
      <ResultCard r={r} raw={raw} locale={locale} m={getMessages(locale)} />
    </div>
  );
}

function Fact({ ok, text, note }: { ok: boolean | null; text: string; note?: string }) {
  const mark = ok === null ? "·" : ok ? "✓" : "–";
  const tone = ok === null ? "text-muted" : ok ? "text-accent" : "text-muted";
  return (
    <li className="flex gap-3">
      <span className={`w-4 shrink-0 text-center font-semibold ${tone}`}>{mark}</span>
      <span>
        {text}
        {note ? <span className="block text-sm text-muted">{note}</span> : null}
      </span>
    </li>
  );
}

function ResultCard({ r, raw, locale, m }: { r: CheckResult; raw: string; locale: Locale; m: Messages }) {
  const c = m.check;
  if (r.kind === "invalid") return <p className="text-sm text-muted">{fmt(c.invalid, { q: raw.trim().slice(0, 40) })}</p>;
  if (r.kind === "unavailable") return <p className="text-sm text-muted">{c.unavailable}</p>;
  if (r.kind === "missing") return <p className="text-sm text-muted">{fmt(c.missing, { id: r.input })}</p>;
  if (r.kind === "unknown") {
    return (
      <div className="rounded-xl border border-line p-4">
        <p className="font-semibold">{r.uname}</p>
        <p className="mt-1 text-sm text-muted">
          {fmt(c.uid, { uid: r.uid })}
          {r.room_id ? ` · ${fmt(c.room, { room: r.room_id })}` : ""}
          {r.area ? ` · ${r.area}` : ""}
        </p>
        <ul className="mt-4 space-y-2 leading-6">
          <Fact ok={false} text={c.notObserved} note={c.notObservedNote} />
          <Fact ok={null} text={r.live_status === 1 ? c.biliLive : c.biliOff} note={r.area && !/虚拟/.test(r.area) ? c.wrongArea : undefined} />
        </ul>
      </div>
    );
  }
  const passes = r.level !== null && r.level >= LEVEL_GATE;
  const mins = r.live ? minutesLive(r.live.started_at, r.now) : null;
  const listed = passes && r.live !== null && !r.deleted;
  const gate = LEVEL_GATE;
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-3">
        <Avatar src={r.face} name={r.uname} color="#5b8def" size={48} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.uname}</p>
          <p className="text-sm text-muted">
            {fmt(c.uid, { uid: r.uid })}
            {r.room_id ? ` · ${fmt(c.room, { room: r.room_id })}` : ""}
            {` · ${formatFans(r.fans, m, locale)}`}
          </p>
        </div>
      </div>
      <p className="mt-4 font-medium">{listed ? c.listed : c.notListed}</p>
      <ul className="mt-3 space-y-2 leading-6">
        <Fact ok={true} text={c.observed} note={fmt(c.observedNote, { first: formatDay(r.first_seen_at, locale), last: formatDay(r.last_seen_at, locale) })} />
        <Fact
          ok={passes}
          text={r.level === null ? c.levelUnknown : fmt(passes ? c.levelPass : c.levelFail, { level: r.level, gate })}
          note={passes ? undefined : fmt(c.levelNote, { gate })}
        />
        <Fact
          ok={r.live !== null}
          text={
            r.live
              ? `${c.liveNow}${mins !== null ? fmt(c.liveFor, { t: formatLive(mins, m) }) : ""}${r.live.area ? ` · ${m.topics[topicOf(r.live.area)]}` : ""}`
              : c.notLive
          }
          note={r.live ? undefined : c.notLiveNote}
        />
        <Fact ok={r.weeks_observed >= 1 ? true : null} text={r.weeks_observed >= 1 ? fmt(c.weeks, { n: r.weeks_observed }) : c.weeksZero} note={c.weeksNote} />
        {r.deleted ? <Fact ok={false} text={c.deleted} note={c.deletedNote} /> : null}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        {r.live && r.room_id ? (
          <Link href={localePath(locale, `/watch/${r.room_id}`)} className="rounded-md bg-fg px-3 py-2 text-bg hover:opacity-90">
            {c.goWatch}
          </Link>
        ) : null}
        <a href={removalHref} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-3 py-2 hover:bg-fg/5">
          {c.removal}
        </a>
      </div>
    </div>
  );
}
