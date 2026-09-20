import type { PublishedWeek } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/types";
import { shortMD } from "@/lib/time";

type Props = { week: PublishedWeek; color: string; today?: string };

/** One week as a 7-row list. Pure; used by the public page and the editor preview. */
export function WeekView({ week, color, today }: Props) {
  return (
    <ol className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {week.days.map((d) => {
        const isToday = d.date === today;
        return (
          <li key={d.weekday} className="flex gap-4 px-4 py-3">
            <div className="w-16 shrink-0">
              <div className={isToday ? "font-semibold" : "font-medium"}>
                {WEEKDAY_LABELS[d.weekday]}
              </div>
              <div className="text-xs text-neutral-500">{shortMD(d.date)}</div>
            </div>
            <div className="min-w-0 flex-1">
              {d.off ? (
                <span className="text-neutral-400">定休</span>
              ) : (
                <ul className="space-y-1">
                  {d.slots.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono tabular-nums" style={{ color }}>
                        {s.start}–{s.end}
                      </span>
                      <span>{s.type}</span>
                      {s.note ? <span className="text-sm text-neutral-500">{s.note}</span> : null}
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
