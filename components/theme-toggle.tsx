"use client";

import { IconMoon, IconSun } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import { useLocalString, writeLocal } from "@/lib/local-store";

export const THEME_KEY = "tenkyu:theme";
export type Theme = "dark" | "light";

/** Applied before paint by the inline script in the locale layout; this keeps it in sync afterwards. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle({ className }: { className?: string }) {
  const { m } = useI18n();
  const stored = useLocalString(THEME_KEY);
  const theme: Theme = stored === "light" ? "light" : "dark";
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        writeLocal(THEME_KEY, next);
        applyTheme(next);
      }}
      className={className}
      aria-label={m.theme.toggle}
      title={theme === "dark" ? m.theme.light : m.theme.dark}
    >
      {theme === "dark" ? <IconSun className="h-6 w-6" /> : <IconMoon className="h-6 w-6" />}
    </button>
  );
}
