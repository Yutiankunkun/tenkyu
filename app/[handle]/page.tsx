import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { TzToggle } from "@/components/tz-provider";
import { WeekView } from "@/components/week-view";
import { HANDLE_RE, getPublishedSchedule } from "@/lib/schedule";
import { SITE_URL } from "@/lib/site";
import { addDays, currentWeekStart, isMonday, parseISODate, shanghaiNow, shortMD, toISODate } from "@/lib/time";

type Params = Promise<{ handle: string }>;
type SP = Promise<{ w?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  if (!HANDLE_RE.test(handle)) return {};
  const data = await getPublishedSchedule(handle, currentWeekStart());
  if (!data) return {};
  const title = `${data.display_name} 的本周直播`;
  const description = data.intro || `${data.display_name} 的直播时间表（北京时间）`;
  return {
    title,
    description,
    openGraph: { title, description, url: `${SITE_URL}/${handle}` },
  };
}

export default function StreamerPage(props: { params: Params; searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">加载中…</p>}>
        <StreamerWeek {...props} />
      </Suspense>
    </main>
  );
}

/** ?w= may only wander a little around the current week (each value is a cache entry). */
function resolveWeekStart(w: string | undefined, current: string): string {
  if (!w || !isMonday(w)) return current;
  const cur = parseISODate(current)!;
  const req = parseISODate(w)!;
  const diffWeeks = Math.round((req.getTime() - cur.getTime()) / (7 * 86400000));
  return diffWeeks >= -4 && diffWeeks <= 8 ? w : current;
}

async function StreamerWeek({ params, searchParams }: { params: Params; searchParams: SP }) {
  const [{ handle }, sp] = await Promise.all([params, searchParams]);
  if (!HANDLE_RE.test(handle)) notFound();

  await connection();
  const current = currentWeekStart();
  const today = toISODate(shanghaiNow());
  const weekStart = resolveWeekStart(sp.w, current);

  const data = await getPublishedSchedule(handle, weekStart);
  if (!data) notFound();
  const week = data.weeks[0];
  const prev = toISODate(addDays(parseISODate(weekStart)!, -7));
  const next = toISODate(addDays(parseISODate(weekStart)!, 7));

  return (
    <article className="space-y-6">
      <header className="flex items-center gap-4">
        <Avatar src={data.avatar_url} name={data.display_name} color={data.theme_color} size={56} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{data.display_name}</h1>
          {data.intro ? <p className="text-sm text-muted">{data.intro}</p> : null}
        </div>
        {data.bili_room_url ? (
          <a
            href={data.bili_room_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: data.theme_color }}
          >
            去直播间
          </a>
        ) : null}
      </header>

      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <Link href={`/${handle}?w=${prev}`} className="text-muted hover:text-fg">
            ← 上一周
          </Link>
          <span className="font-medium">
            {shortMD(week.week_start)} – {shortMD(week.days[6].date)}
            {weekStart === current ? "（本周）" : ""}
          </span>
          <Link href={`/${handle}?w=${next}`} className="text-muted hover:text-fg">
            下一周 →
          </Link>
        </div>
        <TzToggle />
      </nav>

      <WeekView week={week} color={data.theme_color} today={today} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>以主播直播间公告为准。</span>
        <span>
          把 <code className="rounded bg-fg/5 px-1">tenkyu.app/{handle}</code> 贴在 B 站简介里，粉丝随时能看。
        </span>
      </div>
    </article>
  );
}
