# 天球 Tenkyu

**When does she stream this week?**

Tenkyu is a small, free web tool for small Chinese-speaking VTubers on
Bilibili — 个人势, newcomers, streamers with a handful of viewers — and for
the fans and operators who follow several of them at once.

Live at **https://tenkyu.app** (Simplified Chinese UI).

## What it does

- **Weekly schedule, maintained by the streamer.** A streamer logs in
  (magic link, vetted invite only), sets a weekly template plus this week's
  exceptions, and gets a public week page at `tenkyu.app/<handle>`.
- **Merged view.** `tenkyu.app/w?s=a,b,c` shows several streamers side by
  side. Picks live in the browser and in the URL — no fan accounts.
- **周报图 export.** One click renders the week as a PNG, replacing the
  hand-made schedule image most small streamers post every week.
- **观星台 (the observatory).** A live board of every Bilibili VTuber-area
  room currently streaming, built for finding *small* streams: a level gate
  keeps throwaway accounts out, and the board is sorted for discovery, not
  popularity. Each room has a watch page that embeds Bilibili's official
  player; favourites stay in your browser.

## Principles

- **One dataset, three readers.** The streamer is the only writer. Fans and
  operators read the same public data; "groups" are just links.
- **No fan accounts, no custody of other people's data.** The only account
  type is a streamer editing her own public schedule.
- **Bilibili data is enhancement, never dependency.** The schedule works with
  every Bilibili endpoint down. Live data is collected from public endpoints
  only, at a polite pace, and is never scraped from HTML.
- **Honest numbers.** 人气值 (Bilibili's "popularity") is never shown. The
  board's discovery axis is the room's logged-in viewer count; its trust axis
  is account level plus how many weeks we have observed the room streaming.
  Intensity (hours, streams per week) is never rewarded — it is the one
  metric throwaway accounts maximise.
- **No negative labels, no reports, no blacklists, no donation UI.**
- **Free, non-commercial, run by one person.** Expect small scope and slow
  iteration.

## Architecture

```
streamer ──login──▶ Next.js (Vercel, hnd1) ──▶ Supabase Postgres
                     │  server actions            │  streamer / slot_template / week_override
                     │  cached JSON publish        │  bili_streamer / live_now / live_session
fans / operators ◀───┘  static-ish pages           ▲
                                                   │ PostgREST (service role)
GitHub Actions (every ~10 min) ──▶ collector/sweep.mjs ──▶ Bilibili public live API
```

- **Web app**: Next.js 16 (App Router, Cache Components), React 19,
  Tailwind v4. Public pages are cached and tagged; a streamer's save
  revalidates only her tag. The observatory's board query is one Postgres
  function (`stars_page`) that gates, filters, sorts and paginates in the
  database.
- **Database / auth**: Supabase (Postgres + magic-link auth). Row-level
  security: public read, streamer writes her own rows, the collector writes
  with the service role.
- **Collector**: a dependency-free Node script on GitHub Actions. Each run
  sweeps the VTuber area room list, fetches per-room details in batches,
  backfills account level / fans for newly seen streamers, archives finished
  sessions, and dispatches the next run (GitHub's `schedule` trigger proved
  unreliable, so the workflow chains itself). Risk control from Bilibili
  fails the run so the owner gets an email.

## Repository layout

```
app/            routes (App Router)
  [handle]/     public week page          w/          merged view
  edit/         streamer editor           admin/      onboarding admin (email allowlist)
  stars/        观星台 board + about       watch/      per-room watch page
  api/          img proxy (hdslb only), live, streamers, revalidate
  data/         per-streamer JSON
components/     UI (week view, merged view, board grid, schedule image, ...)
lib/            schedule maths, time zones, Bilibili client, Supabase clients
collector/      sweep.mjs (the collector), probe.mjs (endpoint reachability check)
supabase/       migrations/0001…0006 (apply in order), seed.example.sql
.github/        collector.yml (self-chaining loop), bili-probe.yml
```

## Running it yourself

```bash
pnpm install
cp .env.example .env.local   # fill in the Supabase values
pnpm dev                      # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm build
```

1. Create a Supabase project and run `supabase/migrations/*.sql` in order in
   the SQL editor. `seed.example.sql` shows how to invite a first streamer.
2. Set the env vars from `.env.example`. `ADMIN_EMAILS` gates `/admin`;
   `REVALIDATE_SECRET` is shared with the collector.
3. For the collector, add repository secrets `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `REVALIDATE_SECRET` and dispatch `collector.yml`
   once; it keeps itself running. `bili-probe.yml` checks that the runner
   can reach the Bilibili endpoints.

The app is deployed on Vercel; the Supabase project and the Vercel functions
sit in Tokyo.

## Status

Early and personal. v1 (schedules, merged view, image export) and the first
version of the observatory are live. Ranking inside the board, observed-weeks
badges and a visual redesign are in progress. Issues and ideas are welcome;
the product deliberately stays small.

## License

Not yet licensed. The source is public for transparency; all rights are
reserved until a license is chosen. Open an issue if you want to reuse
something.
