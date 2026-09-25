"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { IconCheck, IconClose, IconHeart, IconHome, IconInfo, IconMenu, IconSearch } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/**
 * Holodex skeleton: 56 px app bar, 220 px left drawer (persistent from lg, overlay below),
 * bottom navigation on phones. Route-aware highlighting reads the URL, so it sits in Suspense.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, m } = useI18n();
  const [open, setOpen] = useState(false);
  const home = localePath(locale, "/");

  return (
    <div className="min-h-full">
      <header className="fixed inset-x-0 top-0 z-40 h-14 bg-bar text-bar-fg shadow-md">
        <div className="flex h-14 items-center gap-2 px-2 sm:px-3">
          <button type="button" onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-white/10 lg:hidden" aria-label={m.nav.menu}>
            <IconMenu className="h-6 w-6" />
          </button>
          <Link href={home} className="flex items-center gap-2 px-1 text-xl font-semibold tracking-tight">
            <span className="inline-block h-5 w-5 rounded-full border-[3px] border-white/90" aria-hidden />
            <span>
              {m.site.short}
              <span className="ml-1 hidden text-sm font-normal opacity-80 sm:inline">{m.site.latin}</span>
            </span>
          </Link>
          <form action={home} method="get" className="mx-auto hidden w-full max-w-xl items-center sm:flex">
            <label className="relative w-full">
              <input
                name="q"
                placeholder={m.nav.search}
                maxLength={40}
                className="h-9 w-full rounded-md border border-white/20 bg-black/25 pl-3 pr-10 text-sm text-white placeholder:text-white/60 focus:bg-black/35 focus:outline-none"
              />
              <button type="submit" className="absolute right-0 top-0 h-9 w-10 rounded-r-md text-white/80 hover:text-white" aria-label={m.board.search}>
                <IconSearch className="mx-auto h-5 w-5" />
              </button>
            </label>
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link href={localePath(locale, "/?focus=search")} className="rounded-full p-2 hover:bg-white/10 sm:hidden" aria-label={m.board.search}>
              <IconSearch className="h-6 w-6" />
            </Link>
            <ThemeToggle className="rounded-full p-2 hover:bg-white/10" />
            <Suspense fallback={<span className="w-10" />}>
              <LangSwitch className="rounded-full px-2 py-2 text-sm hover:bg-white/10" />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open ? <button type="button" aria-label={m.nav.menu} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden" /> : null}
      <aside
        className={`fixed bottom-0 left-0 top-14 z-50 w-[220px] transform bg-nav text-fg transition-transform lg:z-30 lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-3 py-2 lg:hidden">
            <span className="text-sm text-muted">{m.nav.menu}</span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-fg/10" aria-label={m.nav.menu}>
              <IconClose className="h-5 w-5" />
            </button>
          </div>
          <Suspense fallback={<NavList locale={locale} active={null} onNavigate={() => setOpen(false)} />}>
            <RouteAwareNav locale={locale} onNavigate={() => setOpen(false)} />
          </Suspense>
          <div className="mt-auto space-y-1 border-t border-line px-4 py-3 text-xs text-faint">
            <div>{m.footer.copyright}</div>
            <div>{m.footer.timezone}</div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="pt-14 lg:pl-[220px]">
        <main className="min-h-[calc(100vh-56px)] pb-16 lg:pb-0">{children}</main>
      </div>

      {/* Bottom navigation (phones) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch border-t border-line bg-nav lg:hidden">
        <Suspense fallback={<BottomItems locale={locale} active={null} />}>
          <RouteAwareBottom locale={locale} />
        </Suspense>
      </nav>
    </div>
  );
}

type Key = "board" | "favorites" | "check" | "about";
const ITEMS: { key: Key; path: string; Icon: (p: { className?: string }) => React.JSX.Element }[] = [
  { key: "board", path: "/", Icon: IconHome },
  { key: "favorites", path: "/favorites", Icon: IconHeart },
  { key: "check", path: "/check", Icon: IconCheck },
  { key: "about", path: "/about", Icon: IconInfo },
];

function activeKey(pathname: string): Key | null {
  const first = pathname.split("/")[1] ?? "";
  const base = isLocale(first) ? pathname.slice(first.length + 1) || "/" : pathname;
  if (base === "/") return "board";
  const seg = `/${base.split("/")[1] ?? ""}`;
  const hit = ITEMS.find((i) => i.path === seg);
  return hit ? hit.key : null;
}

function RouteAwareNav({ locale, onNavigate }: { locale: Locale; onNavigate: () => void }) {
  const pathname = usePathname() ?? "/";
  const active = activeKey(pathname);
  // Close the overlay drawer whenever the route changes.
  useEffect(() => onNavigate(), [pathname, onNavigate]);
  return <NavList locale={locale} active={active} onNavigate={onNavigate} />;
}

function NavList({ locale, active, onNavigate }: { locale: Locale; active: Key | null; onNavigate: () => void }) {
  const { m } = useI18n();
  return (
    <ul className="px-2 py-1">
      {ITEMS.map(({ key, path, Icon }) => {
        const on = active === key;
        return (
          <li key={key}>
            <Link
              href={localePath(locale, path)}
              onClick={onNavigate}
              className={`flex h-10 items-center gap-4 rounded-md px-3 text-[15px] ${on ? "bg-fg/10 font-medium text-accent" : "text-fg/90 hover:bg-fg/5"}`}
              aria-current={on ? "page" : undefined}
            >
              <Icon className="h-6 w-6" />
              <span>{m.nav[key]}</span>
            </Link>
          </li>
        );
      })}
      <li className="mt-2 border-t border-line pt-2">
        <Link href={localePath(locale, "/privacy")} onClick={onNavigate} className="flex h-9 items-center px-3 text-sm text-muted hover:text-fg">
          {m.nav.privacy}
        </Link>
      </li>
    </ul>
  );
}

function RouteAwareBottom({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "/";
  return <BottomItems locale={locale} active={activeKey(pathname)} />;
}

function BottomItems({ locale, active }: { locale: Locale; active: Key | null }) {
  const { m } = useI18n();
  return (
    <>
      {ITEMS.map(({ key, path, Icon }) => {
        const on = active === key;
        return (
          <Link
            key={key}
            href={localePath(locale, path)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "text-accent" : "text-muted"}`}
            aria-current={on ? "page" : undefined}
          >
            <Icon className="h-6 w-6" />
            <span>{m.nav[key]}</span>
          </Link>
        );
      })}
    </>
  );
}
