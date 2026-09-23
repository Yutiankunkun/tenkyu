import Link from "next/link";

/** Header for the streamer side (/studio). Deliberately has no link into the public navigation. */
export function StudioHeader() {
  const item = "whitespace-nowrap rounded-md px-1.5 py-1 text-sm text-muted hover:text-fg sm:px-2";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/studio/edit" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent" aria-hidden />
          天球 <span className="text-xs font-normal text-muted">入驻</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link href="/studio/edit" className={item}>
            我的日程
          </Link>
          <Link href="/studio/apply" className={item}>
            申请入驻
          </Link>
          <Link href="/studio/login" className={item}>
            登录
          </Link>
        </nav>
      </div>
    </header>
  );
}
