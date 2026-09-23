import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { REMOVAL_FORM_URL, REMOVAL_ISSUE_URL } from "@/lib/site";
import { LEVEL_GATE, formatFans, formatLive, getCheck, minutesLive, topicOf, type CheckResult } from "@/lib/stars";

export const metadata = { title: "观星台 · 查一查我在不在" };

type SP = Promise<{ q?: string | string[] }>;

const removalHref = REMOVAL_FORM_URL ?? REMOVAL_ISSUE_URL;

export default function CheckPage({ searchParams }: { searchParams: SP }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">查一查我在不在观星台</h1>
      <p className="mt-3 leading-7 text-fg/85">
        输入 B 站直播间房间号、UID，或直接粘贴直播间 / 主页链接。结果只来自 B 站的公开信息和天球自己的观测记录。
      </p>
      <form method="get" className="mt-6 flex gap-2">
        <input
          type="text"
          name="q"
          inputMode="numeric"
          placeholder="房间号 / UID / 链接"
          className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 text-base"
          autoComplete="off"
        />
        <button type="submit" className="shrink-0 rounded-md bg-fg px-4 py-2 text-bg hover:opacity-90">
          查询
        </button>
      </form>
      <Suspense fallback={<p className="mt-6 text-sm text-muted">查询中…</p>}>
        <Result searchParams={searchParams} />
      </Suspense>
      <section className="mt-12 space-y-3 border-t border-line pt-6 text-sm leading-6 text-fg/85">
        <h2 className="text-base font-semibold">下架或纠错</h2>
        <p>
          你是主播本人或运营，不希望出现在观星台，或者发现信息有误，请
          <a href={removalHref} target="_blank" rel="noopener noreferrer" className="underline">
            提交下架 / 纠错申请
          </a>
          。我们确认后处理。观星台按善意假设运营，不接受第三方代为申请下架。
        </p>
        <p className="text-muted">
          观星台的规则见
          <Link href="/stars/about" className="underline">
            我们怎么选
          </Link>
          。
        </p>
      </section>
    </main>
  );
}

async function Result({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  if (!raw || !raw.trim()) return null;
  await connection();
  const r = await getCheck(raw);
  return (
    <div className="mt-6">
      <ResultCard r={r} raw={raw} />
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

function ResultCard({ r, raw }: { r: CheckResult; raw: string }) {
  if (r.kind === "invalid") {
    return <p className="text-sm text-muted">看不懂「{raw.trim().slice(0, 40)}」。请输入纯数字的房间号或 UID，或粘贴 live.bilibili.com / space.bilibili.com 的链接。</p>;
  }
  if (r.kind === "unavailable") {
    return <p className="text-sm text-muted">天球没有观测记录，而且 B 站的公开接口暂时没有回应，稍后再试。</p>;
  }
  if (r.kind === "missing") {
    return <p className="text-sm text-muted">天球没有观测记录，B 站也查不到这个号：{r.input}。请确认房间号或 UID 是否正确。</p>;
  }
  if (r.kind === "unknown") {
    return (
      <div className="rounded-xl border border-line p-4">
        <p className="font-semibold">{r.uname}</p>
        <p className="mt-1 text-sm text-muted">
          UID {r.uid}
          {r.room_id ? ` · 房间 ${r.room_id}` : ""}
          {r.area ? ` · ${r.area}` : ""}
        </p>
        <ul className="mt-4 space-y-2 leading-6">
          <Fact ok={false} text="天球还没有观测到这个直播间" note="观星台每 10 分钟扫描一次 B 站虚拟主播分区里正在直播的房间。只要在这个分区开播过一次，之后就会有记录。" />
          <Fact ok={null} text={r.live_status === 1 ? "B 站显示现在正在直播" : "B 站显示现在没有在播"} note={r.area && !/虚拟/.test(r.area) ? "当前分区不是虚拟主播分区，观星台不会收录。" : undefined} />
        </ul>
      </div>
    );
  }
  const passes = r.level !== null && r.level >= LEVEL_GATE;
  const mins = r.live ? minutesLive(r.live.started_at, r.now) : null;
  const listed = passes && r.live !== null && !r.deleted;
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-3">
        <Avatar src={r.face} name={r.uname} color="#5b8def" size={48} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{r.uname}</p>
          <p className="text-sm text-muted">
            UID {r.uid}
            {r.room_id ? ` · 房间 ${r.room_id}` : ""}
            {` · ${formatFans(r.fans)}`}
          </p>
        </div>
      </div>
      <p className="mt-4 font-medium">{listed ? "现在在观星台上。" : "现在不在观星台上。"}</p>
      <ul className="mt-3 space-y-2 leading-6">
        <Fact
          ok={true}
          text={`天球观测到过这个直播间`}
          note={`首次 ${formatDate(r.first_seen_at)}，最近 ${formatDate(r.last_seen_at)}。观星台每 10 分钟扫描一次虚拟主播分区。`}
        />
        <Fact
          ok={passes}
          text={r.level === null ? "账号等级还没有查到" : `账号等级 ${r.level} 级，${passes ? "达到" : "未达到"}观星台的 ${LEVEL_GATE} 级门槛`}
          note={passes ? undefined : `等级是 B 站根据账号日常使用累积的公开信息，达到 ${LEVEL_GATE} 级后会自动出现，不需要申请。`}
        />
        <Fact
          ok={r.live !== null}
          text={r.live ? `现在正在直播${mins !== null ? `，已播 ${formatLive(mins)}` : ""}${r.live.area ? ` · ${topicOf(r.live.area)}` : ""}` : "现在没有在播"}
          note={r.live ? undefined : "观星台只显示此刻在播的房间，下播后会在下一次更新时移除。"}
        />
        {r.deleted ? <Fact ok={false} text="B 站显示这个账号已注销或查询不到" note="观星台会自动移除，不再显示。" /> : null}
        {r.handle ? <Fact ok={true} text="已入驻天球" note="她在天球维护自己的日程。" /> : null}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        {r.live && r.room_id ? (
          <Link href={`/watch/${r.room_id}`} className="rounded-md bg-fg px-3 py-2 text-bg hover:opacity-90">
            去观看页
          </Link>
        ) : null}
        {r.handle ? (
          <Link href={`/${r.handle}`} className="rounded-md border border-line px-3 py-2 hover:bg-fg/5">
            看本周安排
          </Link>
        ) : (
          <Link href="/studio/apply" className="rounded-md border border-line px-3 py-2 hover:bg-fg/5">
            申请入驻
          </Link>
        )}
        <a href={removalHref} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line px-3 py-2 hover:bg-fg/5">
          下架 / 纠错
        </a>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" }).format(d);
}
