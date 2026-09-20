"use client";

import { useSyncExternalStore } from "react";

// localStorage as an external store (useSyncExternalStore), so components read a
// persisted value without setState-in-effect. Server snapshot is null → the server
// HTML renders defaults and the client switches after hydration, no mismatch.

const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
  emit(key);
}

/** The raw string stored under `key` (null when absent / unavailable / on the server). */
export function useLocalString(key: string): string | null {
  return useSyncExternalStore(
    (fn) => subscribe(key, fn),
    () => readLocal(key),
    () => null,
  );
}

const noop = () => () => {};

/** A client-only constant (e.g. the browser's time zone) with an empty server snapshot. */
export function useClientValue<T>(get: () => T, serverValue: T): T {
  return useSyncExternalStore(noop, get, () => serverValue);
}
