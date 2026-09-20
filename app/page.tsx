import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { SiteHeader } from "@/components/site-header";
import { getActiveStreamers } from "@/lib/schedule";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">天球 Tenkyu</h1>
          <p className="text-lg leading-8 text-neutral-600 dark:text-neutral-400">
            小体量 VTuber 的本周直播时间表。主播自己维护，粉丝和运营一页看全。
          </p>
        </div>

        <section className="mt-10 space-y-3">
          <h2 className="text-lg font-semibold">主播</h2>
          <Suspense fallback={<p className="text-neutral-500">加载中…</p>}>
            <StreamerList />
          </Suspense>
        </section>

        <p className="mt-12 text-sm text-neutral-500">
          入驻为审核制。<Link href="/apply" className="underline">申请入驻</Link>
        </p>
      </main>
    </>
  );
}

async function StreamerList() {
  await connection(); // render at request time; the list itself is cached (tag: streamers)
  let list: Awaited<ReturnType<typeof getActiveStreamers>>;
  try {
    list = await getActiveStreamers();
  } catch {
    return <p className="text-neutral-500">主播列表暂时无法加载。</p>;
  }
  if (list.length === 0) return <p className="text-neutral-500">还没有主播上线。</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((s) => (
        <li key={s.handle}>
          <Link
            href={`/${s.handle}`}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <Avatar src={s.avatar_url} name={s.display_name} color={s.theme_color} size={40} />
            <div className="min-w-0">
              <div className="font-medium">{s.display_name}</div>
              {s.intro ? <div className="truncate text-sm text-neutral-500">{s.intro}</div> : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
