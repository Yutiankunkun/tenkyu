-- Tenkyu v2 — per-room details from Bilibili's batch status endpoint:
-- streamer-set tags, the live keyframe (real frame), and the real start time.
-- Apply in Supabase → SQL Editor after 0003_sessions.sql.

alter table public.live_now add column if not exists tags text[] not null default '{}';
alter table public.live_now add column if not exists keyframe text not null default '';
alter table public.live_session add column if not exists tags text[] not null default '{}';

create index if not exists live_now_tags_idx on public.live_now using gin (tags);

-- Second-phase upsert: called after the sweep with details for rooms already in
-- live_now. Overrides started_at with Bilibili's own live_time when known.
create or replace function public.upsert_live_details(rows jsonb)
returns integer
language sql
as $$
  with r as (
    select * from jsonb_to_recordset(rows) as x(uid bigint, tags text[], keyframe text, started_at timestamptz)
  ), upd as (
    update public.live_now l
    set tags = coalesce(r.tags, l.tags),
        keyframe = coalesce(r.keyframe, l.keyframe),
        started_at = coalesce(r.started_at, l.started_at)
    from r
    where l.uid = r.uid
    returning 1
  )
  select count(*)::integer from upd;
$$;

-- close_stale_live now carries tags into the session archive.
create or replace function public.close_stale_live(stale_minutes integer)
returns integer
language sql
as $$
  with stale as (
    delete from public.live_now
    where seen_at < now() - make_interval(mins => stale_minutes)
    returning uid, room_id, started_at, seen_at, title, area, max_online, tags
  ), archived as (
    insert into public.live_session (uid, room_id, started_at, ended_at, title, area, max_online, tags)
    select uid, room_id, started_at, seen_at, title, area, max_online, tags from stale
    where seen_at > started_at + interval '3 minutes'
    returning 1
  )
  select count(*)::integer from archived;
$$;

revoke all on function public.upsert_live_details(jsonb) from public, anon, authenticated;
revoke all on function public.close_stale_live(integer) from public, anon, authenticated;
