"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DrawerFavorites } from "@/components/drawer-favorites";
import { IconBack, IconBilibili, IconCheck, IconHeart, IconHome, IconInfo, IconMenu, IconSearch, IconSettings } from "@/components/icons";
import { LOCALE_NAMES, localePath, stripLocale, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { setDrawerMini, useDrawerMini } from "@/lib/prefs";
import { AUTHOR_BILIBILI_URL } from "@/lib/site";

const COPYRIGHT = "© 2026 Tenkyu"; // English in every locale, like Holodex's footer

/** Colourful mark: a conic ring (the celestial sphere) with a dark core. */
function Logo({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        background: "conic-gradient(from 210deg, #7dd3fc, #a78bfa, #f472b6, #fbbf24, #34d399, #7dd3fc)",
        WebkitMask: "radial-gradient(circle, transparent 46%, #000 48%)",
        mask: "radial-gradient(circle, transparent 46%, #000 48%)",
      }}
    />
  );
}

/**
 * Holodex skeleton: 56 px app bar with a centred search, 220 px left drawer (persistent from
 * lg and collapsible to a 56 px icon rail; overlay below lg), bottom navigation on phones.
 * Anything that reads the URL sits inside <Suspense>.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, m } = useI18n();
  const [open, setOpen] = useState(false); // overlay drawer (below lg)
  const [searchOpen, setSearchOpen] = useState(false); // phone search
  const mini = useDrawerMini(); // desktop rail
  const close = useCallback(() => setOpen(false), []);
  const home = localePath(locale, "/");
  const toggle = () => {
    // Below lg the button opens the overlay; from lg it collapses/expands the rail.
    if (window.matchMedia("(min-width: 1024px)").matches) setDrawerMini(!mini);
    else setOpen((v) => !v);
  };
  const railW = mini ? "lg:w-14" : "lg:w-[220px]";
  const contentPad = mini ? "lg:pl-14" : "lg:pl-[220px]";

  return (
    <div className="min-h-full">
      <header className="fixed inset-x-0 top-0 z-40 h-14 bg-bar text-bar-fg shadow-md">
        {searchOpen ? (
          <form action={home} method="get" className="flex h-14 items-center gap-1 px-2 sm:hidden">
            <button type="button" onClick={() => setSearchOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label={m.nav.closeSearch}>
              <IconBack className="h-6 w-6" />
            </button>
            <input
              name="q"
              autoFocus
              placeholder={m.nav.search}
              maxLength={40}
              className="h-9 min-w-0 flex-1 rounded-md border border-white/20 bg-black/25 px-3 text-sm text-white placeholder:text-white/60 focus:bg-black/35 focus:outline-none"
            />
            <button type="submit" className="rounded-full p-2 hover:bg-white/10" aria-label={m.board.search}>
              <IconSearch className="h-6 w-6" />
            </button>
          </form>
        ) : null}
        <div className={`grid h-14 grid-cols-[1fr_auto_1fr] items-center px-3 sm:px-5 ${searchOpen ? "hidden sm:grid" : ""}`}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggle} className="rounded-full p-2 hover:bg-white/10" aria-label={m.nav.menu}>
              <IconMenu className="h-6 w-6" />
            </button>
            <Link href={home} className="flex items-center gap-2.5 px-1 text-[21px] font-semibold tracking-tight">
              <Logo />
              <span>{m.site.short}</span>
            </Link>
          </div>
          <form action={home} method="get" className="hidden w-[min(555px,40vw)] sm:block">
            <label className="relative block w-full">
              <input
                id="site-search"
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
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => setSearchOpen(true)} className="rounded-full p-2 hover:bg-white/10 sm:hidden" aria-label={m.board.search}>
              <IconSearch className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open ? <button type="button" aria-label={m.nav.menu} onClick={close} className="fixed inset-0 z-40 bg-black/50 lg:hidden" /> : null}
      <aside
        className={`scroll-thin fixed bottom-0 left-0 top-14 z-50 w-[220px] transform overflow-y-auto bg-nav text-fg transition-[transform,width] lg:z-30 lg:translate-x-0 ${railW} ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-full flex-col">
          <Suspense fallback={<NavList locale={locale} active={null} mini={mini} onNavigate={close} />}>
            <RouteAwareNav locale={locale} mini={mini} onNavigate={close} />
          </Suspense>
          {!mini ? <DrawerFavorites onNavigate={close} /> : null}
          <div className={`mt-auto px-4 py-3 text-[11px] text-faint ${mini ? "lg:px-0" : ""}`}>
            <div className={`flex items-center gap-2 whitespace-nowrap ${mini ? "lg:flex-col lg:gap-1" : ""}`}>
              <span className={mini ? "lg:hidden" : ""}>{COPYRIGHT}</span>
              <a href={AUTHOR_BILIBILI_URL} target="_blank" rel="noopener noreferrer" className="rounded p-0.5 text-muted hover:text-fg" aria-label={m.nav.bilibili} title={m.nav.bilibili}>
                <IconBilibili className="h-4 w-4" />
              </a>
              <Link href={localePath(locale, "/settings")} onClick={close} className={`text-accent hover:underline ${mini ? "lg:hidden" : ""}`}>
                {LOCALE_NAMES[locale]}
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className={`pt-14 transition-[padding] ${contentPad}`}>
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

type Key = "board" | "favorites" | "check" | "about" | "settings";
const ITEMS: { key: Key; path: string; Icon: (p: { className?: string }) => React.JSX.Element }[] = [
  { key: "board", path: "/", Icon: IconHome },
  { key: "favorites", path: "/favorites", Icon: IconHeart },
  { key: "check", path: "/check", Icon: IconCheck },
  { key: "about", path: "/about", Icon: IconInfo },
  { key: "settings", path: "/settings", Icon: IconSettings },
];
const BOTTOM: Key[] = ["board", "favorites", "check", "settings"];

function activeKey(pathname: string): Key | null {
  const base = stripLocale(pathname);
  if (base === "/") return "board";
  const seg = `/${base.split("/")[1] ?? ""}`;
  const hit = ITEMS.find((i) => i.path === seg);
  return hit ? hit.key : null;
}

function RouteAwareNav({ locale, mini, onNavigate }: { locale: Locale; mini: boolean; onNavigate: () => void }) {
  const pathname = usePathname() ?? "/";
  const active = activeKey(pathname);
  // Close the overlay drawer when the route changes (not on mount, not on unrelated re-renders).
  const prev = useRef(pathname);
  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    onNavigate();
  }, [pathname, onNavigate]);
  return <NavList locale={locale} active={active} mini={mini} onNavigate={onNavigate} />;
}

/** Holodex list item: 40 px tall, 22 px icon, 14 px label, 16 px side padding. */
function NavList({ locale, active, mini, onNavigate }: { locale: Locale; active: Key | null; mini: boolean; onNavigate: () => void }) {
  const { m } = useI18n();
  return (
    <ul className="py-2">
      {ITEMS.map(({ key, path, Icon }) => {
        const on = active === key;
        return (
          <li key={key}>
            <Link
              href={localePath(locale, path)}
              onClick={onNavigate}
              title={m.nav[key]}
              className={`relative flex h-10 items-center gap-5 px-4 text-[14px] ${on ? "bg-fg/8 font-medium text-accent" : "text-fg/85 hover:bg-fg/5"} ${mini ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}
              aria-current={on ? "page" : undefined}
            >
              {on ? <span className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-accent" aria-hidden /> : null}
              <Icon className={`h-[22px] w-[22px] shrink-0 ${on ? "" : "text-muted"}`} />
              <span className={mini ? "lg:hidden" : ""}>{m.nav[key]}</span>
            </Link>
          </li>
        );
      })}
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
      {ITEMS.filter((i) => BOTTOM.includes(i.key)).map(({ key, path, Icon }) => {
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
