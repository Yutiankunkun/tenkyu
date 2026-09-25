// Locale in the URL: "/" is zh-CN (unprefixed, canonical), "/en/..." is English.
// proxy.ts rewrites unprefixed page paths to "/zh-CN/..." so every route lives under app/[locale].

import { en } from "@/lib/i18n/messages/en";
import { zhCN } from "@/lib/i18n/messages/zh-CN";
import type { Messages } from "@/lib/i18n/types";

export type { Messages };
export const LOCALES = ["zh-CN", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh-CN";

const DICTS: Record<Locale, Messages> = { "zh-CN": zhCN, en };

export function isLocale(v: string | undefined | null): v is Locale {
  return (LOCALES as readonly string[]).includes(v ?? "");
}

export function getMessages(locale: Locale): Messages {
  return DICTS[locale];
}

/** "{name}" placeholders → values. Missing keys are left as-is so a typo is visible, not silent. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Prefix a site-relative path for a locale. The default locale stays unprefixed. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
}

/** The other locale's URL for the same page (path + query), used by the header switch. */
export function switchPath(locale: Locale, pathWithQuery: string): { locale: Locale; href: string } {
  const other: Locale = locale === "en" ? "zh-CN" : "en";
  return { locale: other, href: localePath(other, pathWithQuery) };
}

// ---------------------------------------------------------------- formatting

export function formatFans(n: number | null, m: Messages, locale: Locale): string {
  if (n === null) return "";
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (locale === "zh-CN") {
    if (n >= 10000) return fmt(m.units.fansWan, { n: trim(n / 10000) });
    if (n >= 1000) return fmt(m.units.fansK, { n: trim(n / 1000) });
    return fmt(m.units.fans, { n });
  }
  if (n >= 10000) return fmt(m.units.fansK, { n: Math.round(n / 1000) });
  if (n >= 1000) return fmt(m.units.fansK, { n: trim(n / 1000) });
  return fmt(m.units.fans, { n });
}

/** Wording is deliberately "online", never "watching": guests are not counted. */
export function formatOnline(n: number | null, m: Messages, locale: Locale): string {
  return n === null ? "" : fmt(m.units.online, { n: n.toLocaleString(locale) });
}

export function weeksLabel(weeks: number, m: Messages): string | null {
  return weeks >= 1 ? fmt(m.units.weeks, { n: weeks }) : null;
}

export function formatLive(mins: number, m: Messages): string {
  return mins >= 60 ? fmt(m.units.hoursMinutes, { h: Math.floor(mins / 60), m: mins % 60 }) : fmt(m.units.minutes, { m: mins });
}

export function formatClock(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" });
}

export function formatDay(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: "Asia/Shanghai", month: "short", day: "numeric" }).format(d);
}
