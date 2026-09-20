"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useClientValue, useLocalString, writeLocal } from "@/lib/local-store";
import { TZ_STORAGE_KEY, localZoneName, type TzMode } from "@/lib/tz";

type Ctx = { tz: TzMode; setTz: (m: TzMode) => void; zoneName: string };

const TzContext = createContext<Ctx>({ tz: "shanghai", setTz: () => {}, zoneName: "" });

/** Server renders Shanghai; the stored preference applies after hydration via the local store. */
export function TzProvider({ children }: { children: React.ReactNode }) {
  const raw = useLocalString(TZ_STORAGE_KEY);
  const tz: TzMode = raw === "local" ? "local" : "shanghai";
  const zoneName = useClientValue(localZoneName, "");
  const setTz = useCallback((m: TzMode) => writeLocal(TZ_STORAGE_KEY, m), []);
  const value = useMemo(() => ({ tz, setTz, zoneName }), [tz, setTz, zoneName]);
  return <TzContext.Provider value={value}>{children}</TzContext.Provider>;
}

export function useTz() {
  return useContext(TzContext);
}

export function TzToggle() {
  const { tz, setTz, zoneName } = useTz();
  const base = "px-3 py-1.5 text-sm transition-colors";
  const on = "bg-fg text-bg";
  const off = "text-muted hover:text-fg";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex overflow-hidden rounded-md border border-line" role="group" aria-label="时区">
        <button type="button" className={`${base} ${tz === "shanghai" ? on : off}`} onClick={() => setTz("shanghai")}>
          北京时间
        </button>
        <button type="button" className={`${base} ${tz === "local" ? on : off}`} onClick={() => setTz("local")}>
          本地时间
        </button>
      </div>
      {tz === "local" && zoneName ? <span className="text-xs text-muted">{zoneName}</span> : null}
    </div>
  );
}
