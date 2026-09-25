"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { THEME_KEY, applyTheme, type Theme } from "@/components/theme-toggle";
import { LOCALES, LOCALE_NAMES, langSwitchHref, stripLocale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { useLocalString, writeLocal } from "@/lib/local-store";
import { DENSITY_GRID, setDensity, setOpenOnBilibili, useDensity, useOpenOnBilibili, type Density } from "@/lib/prefs";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md bg-surface p-4 shadow-sm">
      <h2 className="text-base font-medium">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, hint, control }: { label: string; hint?: string; control: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[14px]">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-faint">{hint}</div> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-accent" : "bg-fg/25"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "left-0.5 translate-x-5" : "left-0.5"}`} />
    </button>
  );
}

/**
 * Language rows go through /api/lang, which records the choice in a cookie (so the first-visit
 * auto-detection never overrides it) and lands on the same page in the chosen language.
 * Plain anchors, not <Link>: the target is a route handler that redirects.
 */
function LanguageRows() {
  const { locale } = useI18n();
  const base = stripLocale(usePathname() ?? "/");
  return (
    <ul className="space-y-1">
      {LOCALES.map((l) => (
        <li key={l}>
          <a
            href={langSwitchHref(l, base)}
            hrefLang={l}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-[14px] ${l === locale ? "bg-fg/10 text-accent" : "hover:bg-fg/5"}`}
            aria-current={l === locale ? "true" : undefined}
          >
            <span>{LOCALE_NAMES[l]}</span>
            {l === locale ? <span aria-hidden>✓</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SettingsView() {
  const { m } = useI18n();
  const stored = useLocalString(THEME_KEY);
  const dark = stored !== "light";
  const density = useDensity();
  const openBili = useOpenOnBilibili();
  const setTheme = (d: boolean) => {
    const t: Theme = d ? "dark" : "light";
    writeLocal(THEME_KEY, t);
    applyTheme(t);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{m.settings.title}</h1>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card title={m.settings.language}>
          <p className="text-xs text-faint">{m.settings.languageHint}</p>
          <Suspense fallback={null}>
            <LanguageRows />
          </Suspense>
        </Card>
        <Card title={m.settings.site}>
          <Row label={m.settings.darkMode} control={<Switch on={dark} onChange={setTheme} label={m.settings.darkMode} />} />
          <Row
            label={m.settings.density}
            hint={m.settings.densityHint}
            control={
              <select
                value={density}
                onChange={(e) => setDensity(e.target.value as Density)}
                className="rounded-md border border-line bg-bg px-2 py-1 text-sm"
                aria-label={m.settings.density}
              >
                {(Object.keys(DENSITY_GRID) as Density[]).map((d) => (
                  <option key={d} value={d}>
                    {m.settings.densityOptions[d]}
                  </option>
                ))}
              </select>
            }
          />
          <Row label={m.settings.openBilibili} hint={m.settings.openBilibiliHint} control={<Switch on={openBili} onChange={setOpenOnBilibili} label={m.settings.openBilibili} />} />
        </Card>
      </div>
      <p className="mt-6 text-xs text-faint">{m.settings.stored}</p>
    </div>
  );
}
