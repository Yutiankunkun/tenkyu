-- Tenkyu v1 schema — streamer-maintained weekly schedules.
-- Apply in Supabase → SQL Editor (run once). Idempotent enough to re-run after a
-- failed partial apply thanks to IF NOT EXISTS / OR REPLACE where Postgres allows it.
--
-- Model (see specs/2026-09-20-v1-spec.md §4):
--   streamer        one row per onboarded streamer; created by Tian (service role), never self-registered
--   slot_template   recurring weekly slots (weekday 1..7 = Mon..Sun), minutes from 00:00 Asia/Shanghai
--   week_override   per-(streamer, week, weekday) override: replace slots or mark the day off
--
-- Roles:
--   anon / authenticated  read active streamers + their schedule (public pages, published JSON)
--   owner (authenticated, auth.email() = streamer.auth_email)  edit own profile + schedule
--   service_role          creates streamer rows, flips status, bypasses RLS (server-only key)

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.streamer (
  id            uuid primary key default gen_random_uuid(),
  handle        text not null unique
                check (handle ~ '^[a-z0-9][a-z0-9-]{1,30}$'),
  auth_email    text not null unique
                check (auth_email = lower(auth_email)),
  display_name  text not null default '',
  avatar_url    text not null default '',
  bili_uid      bigint,
  bili_room_id  bigint,
  theme_color   text not null default '#5B8DEF'
                check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  intro         text not null default '',
  status        text not null default 'invited'
                check (status in ('invited', 'active', 'hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.streamer is 'Onboarded streamers. Rows are inserted by the operator (service role) after vetting.';
comment on column public.streamer.handle is 'Public URL slug (/<handle>). Immutable after creation.';
comment on column public.streamer.auth_email is 'Login email (magic link). Lower-cased. Only editable by service role.';
comment on column public.streamer.status is 'invited → active (profile + template exist) → hidden (retired). Only active rows are public.';

create table if not exists public.slot_template (
  id            uuid primary key default gen_random_uuid(),
  streamer_id   uuid not null references public.streamer (id) on delete cascade,
  weekday       smallint not null check (weekday between 1 and 7),             -- 1 = Monday
  start_min     smallint not null check (start_min between 0 and 1439),        -- minutes from 00:00 Asia/Shanghai
  end_min       smallint not null check (end_min > start_min and end_min <= 2879), -- > 1439 = past midnight
  type          text not null default '杂谈' check (char_length(type) between 1 and 20),
  note          text not null default ''   check (char_length(note) <= 200)
);

create index if not exists slot_template_streamer_weekday_idx
  on public.slot_template (streamer_id, weekday);

create table if not exists public.week_override (
  id            uuid primary key default gen_random_uuid(),
  streamer_id   uuid not null references public.streamer (id) on delete cascade,
  week_start    date not null,                                                  -- Monday, Asia/Shanghai
  weekday       smallint not null check (weekday between 1 and 7),
  mode          text not null check (mode in ('replace', 'off')),
  slots         jsonb not null default '[]'::jsonb
                check (jsonb_typeof(slots) = 'array'),
  updated_at    timestamptz not null default now(),
  unique (streamer_id, week_start, weekday),
  check (extract(isodow from week_start) = 1)                                  -- week_start must be a Monday
);

comment on column public.week_override.slots is 'Array of {start_min, end_min, type, note}; validated server-side with zod before write. Ignored when mode = off.';

-- ---------------------------------------------------------------------------
-- 2. Triggers: updated_at + owner-immutable columns
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists streamer_set_updated_at on public.streamer;
create trigger streamer_set_updated_at
  before update on public.streamer
  for each row execute function public.set_updated_at();

drop trigger if exists week_override_set_updated_at on public.week_override;
create trigger week_override_set_updated_at
  before update on public.week_override
  for each row execute function public.set_updated_at();

-- handle / auth_email / status may only change through the service role or the
-- dashboard (postgres role, no JWT). Owners editing via RLS (authenticated) and
-- anon cannot touch them. NOTE: only block the RLS roles — checking
-- `<> 'service_role'` would also block the SQL editor, whose auth.role() is null.
create or replace function public.streamer_guard_protected_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if new.handle     is distinct from old.handle
    or new.auth_email is distinct from old.auth_email
    or new.status     is distinct from old.status then
      raise exception 'handle, auth_email and status are read-only for this role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists streamer_guard_protected_columns on public.streamer;
create trigger streamer_guard_protected_columns
  before update on public.streamer
  for each row execute function public.streamer_guard_protected_columns();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.streamer      enable row level security;
alter table public.slot_template enable row level security;
alter table public.week_override enable row level security;

-- Public read: only active streamers and their schedule.
drop policy if exists "public read streamer" on public.streamer;
create policy "public read streamer" on public.streamer
  for select
  using (status = 'active');

drop policy if exists "public read template" on public.slot_template;
create policy "public read template" on public.slot_template
  for select
  using (exists (
    select 1 from public.streamer s
    where s.id = slot_template.streamer_id and s.status = 'active'
  ));

drop policy if exists "public read override" on public.week_override;
create policy "public read override" on public.week_override
  for select
  using (exists (
    select 1 from public.streamer s
    where s.id = week_override.streamer_id and s.status = 'active'
  ));

-- Owner: the signed-in user whose email matches auth_email (any status, so an
-- invited streamer can complete her profile before going active).
drop policy if exists "owner read self" on public.streamer;
create policy "owner read self" on public.streamer
  for select
  to authenticated
  using (auth.email() = auth_email);

drop policy if exists "owner update self" on public.streamer;
create policy "owner update self" on public.streamer
  for update
  to authenticated
  using (auth.email() = auth_email)
  with check (auth.email() = auth_email);

drop policy if exists "owner all template" on public.slot_template;
create policy "owner all template" on public.slot_template
  for all
  to authenticated
  using (exists (
    select 1 from public.streamer s
    where s.id = slot_template.streamer_id and s.auth_email = auth.email()
  ))
  with check (exists (
    select 1 from public.streamer s
    where s.id = slot_template.streamer_id and s.auth_email = auth.email()
  ));

drop policy if exists "owner all override" on public.week_override;
create policy "owner all override" on public.week_override
  for all
  to authenticated
  using (exists (
    select 1 from public.streamer s
    where s.id = week_override.streamer_id and s.auth_email = auth.email()
  ))
  with check (exists (
    select 1 from public.streamer s
    where s.id = week_override.streamer_id and s.auth_email = auth.email()
  ));

-- No insert/delete policy on streamer on purpose: rows are created and retired
-- by the service role only (dashboard SQL or server actions with the secret key).

-- ---------------------------------------------------------------------------
-- 4. Grants (Supabase default privileges normally cover new tables; explicit for safety)
-- ---------------------------------------------------------------------------
grant select                          on public.streamer, public.slot_template, public.week_override to anon;
grant select, insert, update, delete  on public.streamer, public.slot_template, public.week_override to authenticated;
