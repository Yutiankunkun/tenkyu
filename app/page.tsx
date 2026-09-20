export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-xl space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">天球 Tenkyu</h1>
        <p className="text-lg leading-8 text-neutral-600 dark:text-neutral-400">
          小体量 VTuber 的本周直播时间表。主播自己维护，粉丝和运营一页看全。
        </p>
        <p className="text-sm text-neutral-500">建设中 · 入驻为审核制</p>
      </div>
    </main>
  );
}
