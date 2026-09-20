import Link from "next/link";

export function SiteHeader() {
  const item = "rounded-md px-2 py-1 text-sm text-muted hover:text-fg";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent" aria-hidden />
          天球 <span className="text-xs font-normal text-muted">Tenkyu</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/" className={item}>
            主播
          </Link>
          <Link href="/w" className={item}>
            合并日程
          </Link>
          <Link href="/apply" className={item}>
            入驻
          </Link>
          <Link href="/edit" className={item}>
            主播登录
          </Link>
        </nav>
      </div>
    </header>
  );
}
