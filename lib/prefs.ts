"use client";

// Browser-only preferences (Holodex-style settings page). Nothing here is uploaded.
import { useLocalString, writeLocal } from "@/lib/local-store";

export const DENSITY_KEY = "tenkyu:density";
export const OPEN_BILIBILI_KEY = "tenkyu:openBilibili";
export const DRAWER_KEY = "tenkyu:drawer";

export type Density = "large" | "medium" | "small";

export function useDensity(): Density {
  const v = useLocalString(DENSITY_KEY);
  return v === "medium" || v === "small" ? v : "large";
}
export function setDensity(d: Density) {
  writeLocal(DENSITY_KEY, d);
}

/** Grid classes per density: large ≈ Holodex default (4 columns at 1440), small ≈ 6. */
export const DENSITY_GRID: Record<Density, string> = {
  large: "grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
  medium: "grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  small: "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8",
};

export function useOpenOnBilibili(): boolean {
  return useLocalString(OPEN_BILIBILI_KEY) === "1";
}
export function setOpenOnBilibili(on: boolean) {
  writeLocal(OPEN_BILIBILI_KEY, on ? "1" : null);
}

/** Desktop drawer: expanded (220 px, default) or a 56 px icon rail. */
export function useDrawerMini(): boolean {
  return useLocalString(DRAWER_KEY) === "mini";
}
export function setDrawerMini(mini: boolean) {
  writeLocal(DRAWER_KEY, mini ? "mini" : null);
}
