import type { zhCN } from "@/lib/i18n/messages/zh-CN";

/** Widen the literal types of the zh-CN dictionary so other locales can supply their own strings. */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;

export type Messages = Widen<typeof zhCN>;
