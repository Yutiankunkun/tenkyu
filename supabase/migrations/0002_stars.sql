-- Tenkyu v2 — 观星台: Bilibili live VTuber snapshot collected by collector/sweep.mjs.
-- Apply in Supabase → SQL Editor after 0001_init.sql.
--
-- bili_streamer  every Bilibili VTuber we have ever seen live (public facts only)
-- live_now       rooms live as of the last sweep (replaced every run)
-- Writes: service role only (the collector). Reads: public.

create table if not exists public.bili_streamer (
  uid               bigint primary key,
  uname             text not null default '',
  face              text not null default '',
  room_id           bigint,
  fans              integer,
  level             smallint,             -- account level; the board gate is >= 3
  master_level      smallint,             -- 主播等级; collected, not displayed yet
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  level_fetched_at  timestamptz,
  fans_fetched_at   timestamptz,
  deleted_at        timestamptz           -- account gone (账号已注销 / not found)
);
create index if not exists bili_streamer_backfill_idx on public.bili_streamer (first_seen_at desc) where level is null and deleted_at is null;
create index if not exists bili_streamer_fans_refresh_idx on public.bili_streamer (fans_fetched_at asc nulls first) where deleted_at is null;

create table if not exists public.live_now (
  uid         bigint primary key references public.bili_streamer (uid) on delete cascade,
  room_id     bigint not null,
  title       text not null default '',
  cover       text not null default '',
  online      integer not null default 0,        -- 人气值, not viewers
  area        text not null default '',
  started_at  timestamptz not null default now(), -- first sweep that saw this live session
  seen_at     timestamptz not null default now()
);
create index if not exists live_now_seen_idx on public.live_now (seen_at);

alter table public.bili_streamer enable row level security;
alter table public.live_now      enable row level security;
drop policy if exists "public read bili_streamer" on public.bili_streamer;
create policy "public read bili_streamer" on public.bili_streamer for select using (true);
drop policy if exists "public read live_now" on public.live_now;
create policy "public read live_now" on public.live_now for select using (true);
grant select on public.bili_streamer, public.live_now to anon, authenticated;

-- Upsert helpers used by the collector (service role). They keep first_seen_at /
-- started_at on conflict, which a plain PostgREST upsert would overwrite.
create or replace function public.upsert_bili_streamers(rows jsonb)
returns integer
language sql
as $$
  with r as (
    select * from jsonb_to_recordset(rows) as x(uid bigint, uname text, face text, room_id bigint)
  ), ins as (
    insert into public.bili_streamer (uid, uname, face, room_id, last_seen_at)
    select uid, coalesce(uname, ''), coalesce(face, ''), room_id, now() from r
    on conflict (uid) do update
      set uname = excluded.uname, face = excluded.face, room_id = excluded.room_id, last_seen_at = now()
    returning 1
  )
  select count(*)::integer from ins;
$$;

create or replace function public.upsert_live_now(rows jsonb)
returns integer
language sql
as $$
  with r as (
    select * from jsonb_to_recordset(rows) as x(uid bigint, room_id bigint, title text, cover text, online integer, area text)
  ), ins as (
    insert into public.live_now (uid, room_id, title, cover, online, area, started_at, seen_at)
    select uid, room_id, coalesce(title, ''), coalesce(cover, ''), coalesce(online, 0), coalesce(area, ''), now(), now() from r
    on conflict (uid) do update
      set room_id = excluded.room_id, title = excluded.title, cover = excluded.cover,
          online = excluded.online, area = excluded.area, seen_at = now()
    returning 1
  )
  select count(*)::integer from ins;
$$;

revoke all on function public.upsert_bili_streamers(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_live_now(jsonb) from public, anon, authenticated;
