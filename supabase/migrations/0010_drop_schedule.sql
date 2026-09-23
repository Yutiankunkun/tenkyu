-- Tenkyu — OPTIONAL: drop the retired schedule product's tables (from 0001_init.sql).
-- Apply in Supabase → SQL Editor whenever convenient; nothing in the app references them
-- after 2026-09-23. Irreversible: the streamer / slot_template / week_override rows are gone.
-- The code that used them is preserved at git tag archive/schedule-v1.

drop trigger if exists week_override_set_updated_at on public.week_override;
drop trigger if exists streamer_set_updated_at on public.streamer;
drop trigger if exists streamer_guard_protected_columns on public.streamer;

drop table if exists public.week_override cascade;
drop table if exists public.slot_template cascade;
drop table if exists public.streamer cascade;

drop function if exists public.streamer_guard_protected_columns();
drop function if exists public.set_updated_at();
