-- Indexes for the 观星台 board query (live_now ⋈ bili_streamer filtered by level / fans / deleted_at).
-- Apply in Supabase → SQL Editor after 0004_room_details.sql.
create index if not exists bili_streamer_gate_idx on public.bili_streamer (level, fans) where deleted_at is null;
create index if not exists live_now_started_idx on public.live_now (started_at desc);
