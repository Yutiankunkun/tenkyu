# Tenkyu

**A live observatory for small VTubers on Bilibili.**

Tenkyu lists every room in Bilibili's VTuber area that is streaming right
now, and is built for finding the *small* ones: a handful of viewers, a few
hundred followers, no agency budget. It is free, has no accounts, and is run
by one person.

Live at **https://tenkyu.app** (Simplified Chinese UI; more languages planned).

## What it does

- **The board.** Every live VTuber-area room, refreshed every ten minutes,
  gated by account level so throwaway accounts stay out. Filters by follower
  band and topic, search by name, title or tag.
- **Watch page.** Bilibili's official embedded player, the stream title,
  time live, topic, and the room's logged-in viewer count refreshed every
  minute.
- **Favourites.** Kept in your browser only. A favourites-only view shows
  which of them are live, and lists the rest as offline.
- **Check page.** Paste a room id, UID or Bilibili URL and see whether the
  room is listed and why: observed or not, account level against the gate,
  live or not. Removal and correction requests start there.

## Principles

- **No accounts, no custody of anyone's data.** Favourites live in
  `localStorage`; nothing is uploaded.
- **Public endpoints only, politely.** One sweep every ten minutes, batch
  endpoints where they exist, no HTML scraping, no logged-in cookies.
- **Honest numbers.** Bilibili's popularity score is never shown. The
  discovery axis is the room's logged-in viewer count; the trust axis is
  account level plus how many weeks the room has been observed streaming.
  Intensity (hours, streams per week) is never rewarded.
- **No negative labels, no reports, no blacklists, no donation UI.**
- **Free and non-commercial.** Small scope, slow iteration.

## Architecture

```
GitHub Actions (every ~10 min) ──▶ collector/sweep.mjs ──▶ Bilibili public live API
                                         │
                                         ▼ PostgREST (service role)
                              Supabase Postgres (bili_streamer, live_now, live_session)
                                         │
                                         ▼ anon reads, one RPC per board page
viewers ◀──────────────────── Next.js on Vercel (hnd1)
```

- **Web app**: Next.js 16 (App Router, Cache Components), React 19,
  Tailwind v4. The board query is one Postgres function (`stars_page`) that
  gates, filters, sorts and paginates in the database and returns a page of
  JSON. Pages are cached and revalidated on a timer; nothing is written from
  the web app.
- **Database**: Supabase Postgres with row-level security — public read,
  writes only by the collector's service role.
- **Collectors**: two dependency-free Node scripts. The sweep runs every ten minutes: it sweeps the VTuber
  area room list, fetches per-room details in batches, backfills account
  level and follower counts for newly seen streamers, archives finished
  sessions, refreshes observed weeks, and dispatches the next run (GitHub's
  `schedule` trigger proved unreliable, so the workflow chains itself). The
  online loop visits each gated live room for its logged-in viewer count,
  oldest data first. A Bilibili risk-control response fails a run so the
  owner gets an email.

## Repository layout

```
app/(public)/     board (/), about, check, watch/[room], privacy
app/api/          img proxy (hdslb only), live, online, streamers
components/       board grid, watch-page pieces, header and footer
lib/              board model, Bilibili client, Supabase anon client
collector/        sweep.mjs (rooms, details, profiles), online.mjs (viewer counts), probe.mjs
supabase/         migrations 0001…0010 (apply in order); 0001 is legacy, 0010 optional
.github/          collector.yml + online.yml (self-chaining loops), bili-probe.yml, issue templates
```

Migration `0001_init.sql` created the tables of a retired feature (a
streamer-maintained weekly schedule). They are unused and harmless; drop
them or leave them.

## Running it yourself

```bash
pnpm install
cp .env.example .env.local   # Supabase URL + publishable key
pnpm dev                      # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm build
```

1. Create a Supabase project and run `supabase/migrations/*.sql` in order.
2. Add repository secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then
   dispatch `collector.yml` once; it keeps itself running. `bili-probe.yml`
   checks that the runner can reach the Bilibili endpoints.

The app is deployed on Vercel; the Supabase project and the Vercel functions
sit in Tokyo.

## Status

Early and personal. The board, watch page, favourites and check page are
live. Ranking by viewer count, observed-weeks badges, a visual redesign and
UI language switching are in progress. Issues and ideas are welcome; the
product deliberately stays small.

## Name

Tenkyu (天球, "celestial sphere") follows the studio's naming convention: a
generic word borrowed from a song title. No artist name, likeness, lyrics
or artwork is used anywhere.

## License

MIT. See LICENSE.
