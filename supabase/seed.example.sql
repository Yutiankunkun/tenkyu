-- Seed ONE test streamer so login and the editor can be exercised before a real
-- streamer is onboarded. Run in Supabase → SQL Editor AFTER 0001_init.sql.
-- Replace the email with your own (it must be lower-case). Re-running with a new
-- email UPDATES the row (an earlier version used "do nothing" and silently kept
-- the placeholder — that cost a debugging round on 2026-09-20).
-- Hide the row once a real streamer is live:
--   update public.streamer set status = 'hidden' where handle = 'test';

insert into public.streamer (handle, auth_email, display_name, status)
values ('test', 'you@example.com', '测试主播', 'invited')
on conflict (handle) do update set auth_email = excluded.auth_email;
