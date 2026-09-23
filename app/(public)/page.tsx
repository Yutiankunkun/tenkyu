import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { PickButton } from "@/components/pick-button";
import { StarsPreview } from "@/components/stars-preview";
import { getActiveStreamers } from "@/lib/schedule";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">这周谁几点播</h1>
        <p className="text-lg leading-8 text-muted">
          小体量 VTuber 的直播时间表。主播自己维护，粉丝和运营一页看全，不用一个个翻主页。
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/w" className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
            打开合并日程
          </Link>
          <Link href="/studio/apply" className="rounded-md border border-line px-4 py-2 text-sm hover:bg-fg/5">
            我是主播，申请入驻
          </Link>
        </div>
      </div>

      <div className="mt-12">
        <Suspense fallback={null}>
          <LiveTeaser />
        </Suspense>
      </div>

      <section className="mt-12 space-y-3">
        <h2 className="text-lg font-semibold">入驻主播</h2>
        <Suspense fallback={<p className="text-muted">加载中…</p>}>
          <StreamerList />
        </Suspense>
      </section>
    </main>
  );
}

async function LiveTeaser() {
  await connection();
  return <StarsPreview limit={6} />;
}

async function StreamerList() {
  await connection(); // render at request time; the list itself is cached (tag: streamers)
  let list: Awaited<ReturnType<typeof getActiveStreamers>>;
  try {
    list = await getActiveStreamers();
  } catch {
    return <p className="text-muted">主播列表暂时无法加载。</p>;
  }
  if (list.length === 0) return <p className="text-muted">还没有主播上线。</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((s) => (
        <li key={s.handle} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-3 transition-colors hover:bg-fg/5">
          <Link href={`/${s.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={s.avatar_url} name={s.display_name} color={s.theme_color} size={44} />
            <div className="min-w-0">
              <div className="truncate font-medium">{s.display_name}</div>
              {s.intro ? <div className="truncate text-sm text-muted">{s.intro}</div> : null}
            </div>
          </Link>
          <PickButton handle={s.handle} />
        </li>
      ))}
    </ul>
  );
}
