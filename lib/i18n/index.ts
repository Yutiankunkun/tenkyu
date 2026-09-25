// Locale in the URL: "/" is zh-CN (unprefixed, canonical), "/<locale>/..." for the others.
// proxy.ts rewrites unprefixed page paths to "/zh-CN/..." so every route lives under app/[locale],
// and on a first visit (no preference cookie) redirects to the browser's language.

import { en } from "@/lib/i18n/messages/en";
import { ja } from "@/lib/i18n/messages/ja";
import { ko } from "@/lib/i18n/messages/ko";
import { zhCN } from "@/lib/i18n/messages/zh-CN";
import { zhTW } from "@/lib/i18n/messages/zh-TW";
import type { Messages } from "@/lib/i18n/types";

export type { Messages };
export const LOCALES = ["zh-CN", "zh-TW", "en", "ja", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh-CN";
/** Names in their own language, for the settings page and the drawer footer. */
export const LOCALE_NAMES: Record<Locale, string> = { "zh-CN": "简体中文", "zh-TW": "繁體中文", en: "English", ja: "日本語", ko: "한국어" };
/** Preference cookie written by /api/lang; read by proxy.ts. One year. */
export const LANG_COOKIE = "tenkyu_lang";

const DICTS: Record<Locale, Messages> = { "zh-CN": zhCN, "zh-TW": zhTW, en, ja, ko };

export function isLocale(v: string | undefined | null): v is Locale {
  return (LOCALES as readonly string[]).includes(v ?? "");
}

export function getMessages(locale: Locale): Messages {
  return DICTS[locale];
}

/** Best locale for an Accept-Language header; the default when nothing matches. */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1, i };
    })
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    if (tag.startsWith("zh")) {
      // Traditional-script regions and explicit Hant → zh-TW; everything else Chinese → zh-CN.
      if (/hant|-tw|-hk|-mo/.test(tag)) return "zh-TW";
      return "zh-CN";
    }
    if (tag.startsWith("en")) return "en";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("ko")) return "ko";
  }
  return DEFAULT_LOCALE;
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

/** Strip any locale prefix from a pathname (usePathname() returns the rewritten internal path). */
export function stripLocale(pathname: string): string {
  const first = pathname.split("/")[1] ?? "";
  return isLocale(first) ? pathname.slice(first.length + 1) || "/" : pathname;
}

/** Link that records the preference (cookie) and lands on the same page in `to`. */
export function langSwitchHref(to: Locale, sitePath: string): string {
  return `/api/lang?to=${to}&next=${encodeURIComponent(sitePath)}`;
}

// ---------------------------------------------------------------- formatting

export function formatFans(n: number | null, m: Messages, locale: Locale): string {
  if (n === null) return "";
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (locale === "zh-CN" || locale === "zh-TW" || locale === "ja") {
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
