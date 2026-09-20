// Fan-side selection of streamers for the merged view. Browser-only, no account.
import { readLocal, writeLocal } from "@/lib/local-store";
import { HANDLE_RE, MAX_PICKS } from "@/lib/types";

export const PICKS_STORAGE_KEY = "tenkyu:picks";

export function sanitizePicks(list: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const v of list) {
    if (typeof v !== "string" || !HANDLE_RE.test(v)) continue;
    if (allowed && !allowed.has(v)) continue;
    if (out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_PICKS) break;
  }
  return out;
}

export function parsePicksParam(s: string | null | undefined, allowed?: Set<string>): string[] {
  if (!s) return [];
  return sanitizePicks(s.split(","), allowed);
}

/** Parse the raw stored string (from useLocalString or readLocal). */
export function parseStoredPicks(raw: string | null, allowed?: Set<string>): string[] {
  if (!raw) return [];
  try {
    return sanitizePicks(JSON.parse(raw), allowed);
  } catch {
    return [];
  }
}

export function readPicks(allowed?: Set<string>): string[] {
  return parseStoredPicks(readLocal(PICKS_STORAGE_KEY), allowed);
}

export function writePicks(picks: string[]) {
  writeLocal(PICKS_STORAGE_KEY, JSON.stringify(picks));
}

export function picksHref(picks: string[]): string {
  return picks.length ? `/w?s=${picks.join(",")}` : "/w";
}
