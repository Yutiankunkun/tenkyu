-- Seed ONE test streamer so login and the editor can be exercised before a real
-- streamer is onboarded. Run in Supabase → SQL Editor AFTER 0001_init.sql.
-- Replace the email with your own (it must be lower-case). Hide or delete the row
-- once a real streamer is live:  update public.streamer set status = 'hidden' where handle = 'test';

insert into public.streamer (handle, auth_email, display_name, status)
values ('test', 'you@example.com', '测试主播', 'invited')
on conflict (handle) do nothing;
