import Link from "next/link";
import { Suspense } from "react";
import { ScheduleImage } from "@/components/schedule-image";
import { WeekView } from "@/components/week-view";
import { getOwnerStreamer } from "@/lib/auth";
import { PUBLISHED_WEEKS, buildWeeks } from "@/lib/schedule";
import { createServerSupabase } from "@/lib/supabase/server";
import { currentWeekStart, minutesToHHMM, shanghaiNow, shortMD, toISODate } from "@/lib/time";
import { SLOT_TYPES, WEEKDAY_LABELS, type SlotTemplateRow, type WeekOverrideRow } from "@/lib/types";
import {
  addOverrideSlot,
  addTemplateSlot,
  deleteOverrideSlot,
  deleteTemplateSlot,
  resetDay,
  saveProfile,
  setDayOff,
  signOut,
} from "./actions";

export const metadata = { title: "编辑日程" };

type SP = Promise<{ saved?: string; error?: string }>;

export default function EditPage({ searchParams }: { searchParams: SP }) {
  return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Suspense fallback={<p className="text-muted">加载中…</p>}>
          <Editor searchParams={searchParams} />
        </Suspense>
      </main>
  );
}

const input =
  "rounded-md border border-line bg-bg px-2 py-1.5 text-sm";
const btn =
  "rounded-md border border-line px-2.5 py-1 text-sm hover:bg-fg/5";
const btnPrimary =
  "rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:opacity-90";

async function Editor({ searchParams }: { searchParams: SP }) {
  const [streamer, sp] = await Promise.all([getOwnerStreamer(), searchParams]);
  if (!streamer) {
    return (
      <div className="space-y-4">
        <p>这个邮箱还没有对应的主播资料。入驻是审核制，请先申请。</p>
        <form action={signOut}>
          <button className={btn}>退出登录</button>
        </form>
      </div>
    );
  }

  const sb = await createServerSupabase();
  const [{ data: template }, { data: overrides }] = await Promise.all([
    sb
      .from("slot_template")
      .select("id, weekday, start_min, end_min, type, note")
      .eq("streamer_id", streamer.id)
      .order("weekday")
      .order("start_min")
      .returns<Omit<SlotTemplateRow, "streamer_id">[]>(),
    sb
      .from("week_override")
      .select("week_start, weekday, mode, slots")
      .eq("streamer_id", streamer.id)
      .returns<Pick<WeekOverrideRow, "week_start" | "weekday" | "mode" | "slots">[]>(),
  ]);
  const tpl = template ?? [];
  const ovs = overrides ?? [];
  const from = currentWeekStart();
  const today = toISODate(shanghaiNow());
  const weeks = buildWeeks(from, PUBLISHED_WEEKS, tpl, ovs);
  const publicUrl = `/${streamer.handle}`;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{streamer.display_name || "（未命名）"}</h1>
          <p className="text-sm text-muted">
            {streamer.status === "active" ? (
              <>
                已上线：
                <Link href={publicUrl} className="underline">
                  tenkyu.app{publicUrl}
                </Link>
              </>
            ) : streamer.status === "invited" ? (
              "未上线：填好名字并添加至少一个每周时段后自动上线"
            ) : (
              "已隐藏"
            )}
          </p>
        </div>
        <form action={signOut}>
          <button className={btn}>退出登录</button>
        </form>
      </header>

      {sp.saved ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          已保存。
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {sp.error}
        </p>
      ) : null}

      {/* ---------------- 资料 ---------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">资料</h2>
        <form action={saveProfile} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            名字
            <input name="display_name" defaultValue={streamer.display_name} required maxLength={40} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm sm:col-span-2">
            头像图片链接
            <input name="avatar_url" type="url" defaultValue={streamer.avatar_url} placeholder="https://…" className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            B 站直播间号
            <input name="bili_room_id" inputMode="numeric" defaultValue={streamer.bili_room_id ?? ""} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            B 站 UID
            <input name="bili_uid" inputMode="numeric" defaultValue={streamer.bili_uid ?? ""} className={`${input} mt-1 w-full`} />
          </label>
          <label className="text-sm">
            主题色
            <input name="theme_color" type="color" defaultValue={streamer.theme_color} className="mt-1 block h-9 w-16" />
          </label>
          <label className="text-sm sm:col-span-2">
            一句话介绍
            <input name="intro" defaultValue={streamer.intro} maxLength={200} className={`${input} mt-1 w-full`} />
          </label>
          <div className="sm:col-span-2">
            <button className={btnPrimary}>保存资料</button>
          </div>
        </form>
      </section>

      {/* ---------------- 每周模板 ---------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">每周模板</h2>
        <p className="text-sm text-muted">固定的每周安排。没有时段的日子显示为定休。时间为北京时间。</p>
        <ol className="divide-y divide-line rounded-xl border border-line bg-bg">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((wd) => {
            const slots = tpl.filter((t) => t.weekday === wd);
            return (
              <li key={wd} className="space-y-2 px-4 py-3">
                <div className="flex items-baseline gap-3">
                  <span className="w-12 font-medium">{WEEKDAY_LABELS[wd]}</span>
                  {slots.length === 0 ? <span className="text-muted">定休</span> : null}
                </div>
                {slots.length ? (
                  <ul className="space-y-1 pl-12">
                    {slots.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-mono tabular-nums" style={{ color: streamer.theme_color }}>
                          {minutesToHHMM(s.start_min)}–{minutesToHHMM(s.end_min)}
                        </span>
                        <span>{s.type}</span>
                        {s.note ? <span className="text-muted">{s.note}</span> : null}
                        <form action={deleteTemplateSlot}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-xs text-red-600 hover:underline">删除</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <details className="pl-12">
                  <summary className="cursor-pointer text-xs text-muted">添加时段</summary>
                  <form action={addTemplateSlot} className="mt-2">
                    <input type="hidden" name="weekday" value={wd} />
                    <SlotFields />
                  </form>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ---------------- 本周与接下来 ---------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">本周与接下来</h2>
        <p className="text-sm text-muted">
          按模板生成的四周安排。这里的改动只影响那一天，不改模板。
        </p>
        {weeks.map((week) => (
          <details key={week.week_start} open={week.week_start === from} className="rounded-xl border border-line bg-bg">
            <summary className="cursor-pointer px-4 py-2 font-medium">
              {shortMD(week.week_start)} 起的一周{week.week_start === from ? "（本周）" : ""}
            </summary>
            <ol className="divide-y divide-line border-t border-line">
              {week.days.map((d) => (
                <li key={d.weekday} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className={`w-12 ${d.date === today ? "font-semibold" : "font-medium"}`}>{WEEKDAY_LABELS[d.weekday]}</span>
                    <span className="text-xs text-muted">{shortMD(d.date)}</span>
                    {d.overridden ? <span className="text-xs text-amber-600">已改动</span> : null}
                    {d.off ? <span className="text-muted">定休</span> : null}
                  </div>
                  {d.slots.length ? (
                    <ul className="space-y-1 pl-12">
                      {d.slots.map((s, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="font-mono tabular-nums" style={{ color: streamer.theme_color }}>
                            {s.start}–{s.end}
                          </span>
                          <span>{s.type}</span>
                          {s.note ? <span className="text-muted">{s.note}</span> : null}
                          <form action={deleteOverrideSlot}>
                            <input type="hidden" name="week_start" value={week.week_start} />
                            <input type="hidden" name="weekday" value={d.weekday} />
                            <input type="hidden" name="index" value={i} />
                            <button className="text-xs text-red-600 hover:underline">删除</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pl-12">
                    {!d.off ? (
                      <form action={setDayOff}>
                        <input type="hidden" name="week_start" value={week.week_start} />
                        <input type="hidden" name="weekday" value={d.weekday} />
                        <button className={btn}>这天休息</button>
                      </form>
                    ) : null}
                    {d.overridden ? (
                      <form action={resetDay}>
                        <input type="hidden" name="week_start" value={week.week_start} />
                        <input type="hidden" name="weekday" value={d.weekday} />
                        <button className={btn}>恢复模板</button>
                      </form>
                    ) : null}
                    <details>
                      <summary className={`${btn} cursor-pointer list-none`}>加时段</summary>
                      <form action={addOverrideSlot} className="mt-2">
                        <input type="hidden" name="week_start" value={week.week_start} />
                        <input type="hidden" name="weekday" value={d.weekday} />
                        <SlotFields />
                      </form>
                    </details>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </section>

      {/* ---------------- 周报图 ---------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">周报图</h2>
        <p className="text-sm text-muted">用当前日程生成一张可以直接发动态的图。</p>
        {streamer.status === "active" ? (
          <ScheduleImage handle={streamer.handle} displayName={streamer.display_name} themeColor={streamer.theme_color} avatarUrl={streamer.avatar_url} />
        ) : (
          <p className="text-sm text-muted">上线后可用。</p>
        )}
      </section>

      {/* ---------------- 预览 ---------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">粉丝看到的本周</h2>
        <WeekView week={weeks[0]} color={streamer.theme_color} today={today} />
      </section>
    </div>
  );
}

function SlotFields() {
  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <label>
        开始
        <input name="start" type="time" required className={`${input} mt-1 block`} />
      </label>
      <label>
        结束
        <input name="end" type="time" required className={`${input} mt-1 block`} />
      </label>
      <label className="flex items-center gap-1 pb-2">
        <input name="next_day" type="checkbox" /> 次日
      </label>
      <label>
        类型
        <select name="type" className={`${input} mt-1 block`}>
          {SLOT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        自定义类型
        <input name="type_custom" maxLength={20} placeholder="可选" className={`${input} mt-1 block w-28`} />
      </label>
      <label className="grow">
        备注
        <input name="note" maxLength={200} placeholder="可选" className={`${input} mt-1 block w-full`} />
      </label>
      <button className={btnPrimary}>添加</button>
    </div>
  );
}
