import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          天球 <span className="text-neutral-400">Tenkyu</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
          <Link href="/apply" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            入驻
          </Link>
          <Link href="/edit" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            主播登录
          </Link>
        </nav>
      </div>
    </header>
  );
}
