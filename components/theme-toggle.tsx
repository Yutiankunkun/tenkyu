"use client";

import { useEffect } from "react";
import { useLocalString } from "@/lib/local-store";

export const THEME_KEY = "tenkyu:theme";
export type Theme = "dark" | "light";

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Keeps <html data-theme> equal to the stored choice. The inline script in the locale layout
 * covers the first paint; this covers client-side navigations (a layout re-render must never
 * reset the attribute) and changes made in another tab.
 */
export function ThemeSync() {
  const stored = useLocalString(THEME_KEY);
  useEffect(() => {
    applyTheme(stored === "light" ? "light" : "dark");
  }, [stored]);
  return null;
}
