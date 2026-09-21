-- Tenkyu v2 — live session history (for 观测日程 / stability signals later).
-- Apply in Supabase → SQL Editor after 0002_stars.sql.
--
-- live_session  one row per finished live session, closed when a live_now row
--               goes stale (not seen for 20 min). started_at comes from live_now.

alter table public.live_now add column if not exists max_online integer not null default 0;

create table if not exists public.live_session (
  id          bigserial primary key,
  uid         bigint not null references public.bili_streamer (uid) on delete cascade,
  room_id     bigint not null,
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  title       text not null default '',
  area        text not null default '',
  max_online  integer not null default 0
);
create index if not exists live_session_uid_started_idx on public.live_session (uid, started_at desc);
create index if not exists live_session_started_idx on public.live_session (started_at desc);

alter table public.live_session enable row level security;
drop policy if exists "public read live_session" on public.live_session;
create policy "public read live_session" on public.live_session for select using (true);
grant select on public.live_session to anon, authenticated;

-- live_now upsert now also tracks the session's peak 人气.
create or replace function public.upsert_live_now(rows jsonb)
returns integer
language sql
as $$
  with r as (
    select * from jsonb_to_recordset(rows) as x(uid bigint, room_id bigint, title text, cover text, online integer, area text)
  ), ins as (
    insert into public.live_now (uid, room_id, title, cover, online, area, started_at, seen_at, max_online)
    select uid, room_id, coalesce(title, ''), coalesce(cover, ''), coalesce(online, 0), coalesce(area, ''), now(), now(), coalesce(online, 0) from r
    on conflict (uid) do update
      set room_id = excluded.room_id, title = excluded.title, cover = excluded.cover,
          online = excluded.online, area = excluded.area, seen_at = now(),
          max_online = greatest(public.live_now.max_online, excluded.online)
    returning 1
  )
  select count(*)::integer from ins;
$$;

-- Close sessions for rooms not seen in the last `stale_minutes`: archive to
-- live_session (ended_at = last seen), then drop them from live_now.
create or replace function public.close_stale_live(stale_minutes integer)
returns integer
language sql
as $$
  with stale as (
    delete from public.live_now
    where seen_at < now() - make_interval(mins => stale_minutes)
    returning uid, room_id, started_at, seen_at, title, area, max_online
  ), archived as (
    insert into public.live_session (uid, room_id, started_at, ended_at, title, area, max_online)
    select uid, room_id, started_at, seen_at, title, area, max_online from stale
    where seen_at > started_at + interval '3 minutes'   -- ignore blips shorter than one sweep
    returning 1
  )
  select count(*)::integer from archived;
$$;

revoke all on function public.upsert_live_now(jsonb) from public, anon, authenticated;
revoke all on function public.close_stale_live(integer) from public, anon, authenticated;
