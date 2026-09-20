import { TimeRange } from "@/components/time-range";
import type { PublishedWeek } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/types";
import { shortMD } from "@/lib/time";

type Props = { week: PublishedWeek; color: string; today?: string };

/** One week as a 7-row list. Times follow the timezone toggle via <TimeRange>. */
export function WeekView({ week, color, today }: Props) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-bg">
      {week.days.map((d) => {
        const isToday = d.date === today;
        return (
          <li
            key={d.weekday}
            className="flex gap-4 px-4 py-3"
            style={isToday ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined}
          >
            <div className="w-16 shrink-0">
              <div className={isToday ? "font-semibold" : "font-medium"}>{WEEKDAY_LABELS[d.weekday]}</div>
              <div className="whitespace-nowrap text-xs text-muted">{shortMD(d.date)}{isToday ? " · 今天" : ""}</div>
            </div>
            <div className="min-w-0 flex-1">
              {d.off ? (
                <span className="text-muted">定休</span>
              ) : (
                <ul className="space-y-1">
                  {d.slots.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                      <TimeRange date={d.date} start={s.start} end={s.end} style={{ color }} />
                      <span>{s.type}</span>
                      {s.note ? <span className="text-sm text-muted">{s.note}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
