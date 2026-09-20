"use client";

import { useTz } from "@/components/tz-provider";
import { dayShiftSuffix, hhmmToMin, toLocalLabel } from "@/lib/tz";

type Props = { date: string; start: string; end: string; className?: string; style?: React.CSSProperties };

/** "20:00–23:00" in Shanghai, or converted to the viewer's zone when the toggle says so. */
export function TimeRange({ date, start, end, className, style }: Props) {
  const { tz } = useTz();
  let text = `${start}–${end}`;
  if (tz === "local") {
    const s = hhmmToMin(start);
    const e = hhmmToMin(end);
    if (s !== null && e !== null) {
      const a = toLocalLabel(date, s);
      const b = toLocalLabel(date, e);
      text = `${a.text}${dayShiftSuffix(a.dayShift)}–${b.text}${dayShiftSuffix(b.dayShift)}`;
    }
  }
  return (
    <span className={`font-mono tabular-nums ${className ?? ""}`} style={style}>
      {text}
    </span>
  );
}
