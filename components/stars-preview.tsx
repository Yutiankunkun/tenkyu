import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { formatFans, getStars, topicOf } from "@/lib/stars";

/** Home teaser: a few currently-live small VTubers from 观星台. Server component; call behind Suspense + connection(). */
export async function StarsPreview({ limit = 6 }: { limit?: number }) {
  let rows: Awaited<ReturnType<typeof getStars>>["rows"] = [];
  let total = 0;
  try {
    const data = await getStars({ band: "small", topic: null, q: null, sort: "new", page: 1, size: limit });
    total = data.total;
    rows = data.rows;
  } catch {
    return null;
  }
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">现在在播</h2>
        <Link href="/stars" className="text-sm text-muted hover:text-fg">
          观星台 · {total} 位在播 →
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.uid} className="overflow-hidden rounded-xl border border-line bg-bg">
            <Link href={`/watch/${r.room_id}`} className="block">
              <div className="aspect-video bg-fg/5">
                {r.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex items-center gap-2 p-2.5">
                <Avatar src={r.bili_streamer.face} name={r.bili_streamer.uname} color="#5b8def" size={28} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.bili_streamer.uname}</div>
                  <div className="truncate text-xs text-muted">
                    {r.area ? `${topicOf(r.area)} · ` : ""}
                    {formatFans(r.bili_streamer.fans)}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
