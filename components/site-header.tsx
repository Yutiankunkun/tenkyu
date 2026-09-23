import Link from "next/link";

export function SiteHeader() {
  const item = "whitespace-nowrap rounded-md px-1.5 py-1 text-sm text-muted hover:text-fg sm:px-2";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent" aria-hidden />
          天球 <span className="hidden text-xs font-normal text-muted sm:inline">Tenkyu</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link href="/" className={item}>
            观星台
          </Link>
          <Link href="/check" className={item}>
            查一查
          </Link>
          <Link href="/about" className={item}>
            说明
          </Link>
        </nav>
      </div>
    </header>
  );
}
