import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { SiteHeader } from "@/components/site-header";
import { WeekView } from "@/components/week-view";
import { HANDLE_RE, getPublishedSchedule } from "@/lib/schedule";
import { addDays, currentWeekStart, isMonday, parseISODate, shanghaiNow, shortMD, toISODate } from "@/lib/time";

type Params = Promise<{ handle: string }>;
type SP = Promise<{ w?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params;
  if (!HANDLE_RE.test(handle)) return {};
  const data = await getPublishedSchedule(handle, currentWeekStart());
  if (!data) return {};
  return {
    title: `${data.display_name} 的本周直播`,
    description: data.intro || `${data.display_name} 的直播时间表（北京时间）`,
  };
}

export default function StreamerPage(props: { params: Params; searchParams: SP }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Suspense fallback={<p className="text-neutral-500">加载中…</p>}>
          <StreamerWeek {...props} />
        </Suspense>
      </main>
    </>
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
          {data.intro ? <p className="text-sm text-neutral-600 dark:text-neutral-400">{data.intro}</p> : null}
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

      <nav className="flex items-center justify-between text-sm">
        <Link href={`/${handle}?w=${prev}`} className="text-neutral-500 hover:underline">
          ← 上一周
        </Link>
        <span className="font-medium">
          {shortMD(week.week_start)} – {shortMD(week.days[6].date)}
          {weekStart === current ? "（本周）" : ""}
        </span>
        <Link href={`/${handle}?w=${next}`} className="text-neutral-500 hover:underline">
          下一周 →
        </Link>
      </nav>

      <WeekView week={week} color={data.theme_color} today={today} />

      <p className="text-xs text-neutral-400">
        时间为北京时间。以主播直播间公告为准。
      </p>
    </article>
  );
}
