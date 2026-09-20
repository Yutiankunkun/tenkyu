import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted">
        <span>© 2026 天球 Tenkyu</span>
        <span className="flex items-center gap-4">
          <span>时间默认为北京时间</span>
          <Link href="/privacy" className="hover:text-fg">
            隐私说明
          </Link>
        </span>
      </div>
    </footer>
  );
}
