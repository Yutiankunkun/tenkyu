import { connection } from "next/server";
import { Suspense } from "react";
import { MergedView } from "@/components/merged-view";
import { getActiveStreamers } from "@/lib/schedule";
import { shanghaiNow, toISODate } from "@/lib/time";

export const metadata = {
  title: "合并日程",
  description: "把几位主播这周的直播放在一张表里看。",
};

export default function MergedPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">合并日程</h1>
      <p className="mt-1 text-sm text-muted">选几位主播，一张表看全。链接可以直接分享给粉丝或运营。</p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-muted">加载中…</p>}>
          <MergedLoader />
        </Suspense>
      </div>
    </main>
  );
}

async function MergedLoader() {
  await connection();
  let streamers: Awaited<ReturnType<typeof getActiveStreamers>> = [];
  try {
    streamers = await getActiveStreamers();
  } catch {
    return <p className="text-muted">主播列表暂时无法加载。</p>;
  }
  return <MergedView streamers={streamers} today={toISODate(shanghaiNow())} />;
}
