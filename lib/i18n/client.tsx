"use client";

import { createContext, useContext } from "react";
import type { Locale, Messages } from "@/lib/i18n";

type Ctx = { locale: Locale; m: Messages };
const I18nContext = createContext<Ctx | null>(null);

/** Mounted once per locale layout; client components read the dictionary from here. */
export function LocaleProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, m: messages }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LocaleProvider");
  return ctx;
}
