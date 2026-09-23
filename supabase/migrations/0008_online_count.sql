-- Tenkyu — logged-in viewer counts ("online") per live room.
-- Apply in Supabase → SQL Editor after 0007_hidden.sql.
--
-- The collector fetches getOnlineGoldRank.onlineNum per live room in its own phase and
-- writes it through set_online_counts(). live_now.online (Bilibili's popularity score)
-- stays for history but is never shown or sorted on.

alter table public.live_now add column if not exists online_count integer;          -- null = not fetched yet this session
alter table public.live_now add column if not exists online_fetched_at timestamptz;
alter table public.live_now add column if not exists max_online_count integer;      -- session peak of online_count
alter table public.live_session add column if not exists max_online_count integer;

-- Bulk write from the collector: rows = [{uid, online_count}, ...].
create or replace function public.set_online_counts(rows jsonb)
returns integer
language sql
as $$
  with r as (
    select * from jsonb_to_recordset(rows) as x(uid bigint, online_count integer)
  ), upd as (
    update public.live_now l
    set online_count = r.online_count,
        online_fetched_at = now(),
        max_online_count = greatest(coalesce(l.max_online_count, 0), coalesce(r.online_count, 0))
    from r
    where l.uid = r.uid and r.online_count is not null
    returning 1
  )
  select count(*)::integer from upd;
$$;
revoke all on function public.set_online_counts(jsonb) from public, anon, authenticated;

-- close_stale_live carries the session peak into the archive.
create or replace function public.close_stale_live(stale_minutes integer)
returns integer
language sql
as $$
  with stale as (
    delete from public.live_now
    where seen_at < now() - make_interval(mins => stale_minutes)
    returning uid, room_id, started_at, seen_at, title, area, max_online, tags, max_online_count
  ), archived as (
    insert into public.live_session (uid, room_id, started_at, ended_at, title, area, max_online, tags, max_online_count)
    select uid, room_id, started_at, seen_at, title, area, max_online, tags, max_online_count from stale
    where seen_at > started_at + interval '3 minutes'
    returning 1
  )
  select count(*)::integer from archived;
$$;
revoke all on function public.close_stale_live(integer) from public, anon, authenticated;

-- stars_page gains an online band filter and an 'online' sort, and returns online_count.
--   p_online: null (all) | 'le10' (0–10) | '11_30' | '31_50' | 'gt50'
--   p_sort:   'new' (started_at desc) | 'small' (fans asc) | 'online' (online_count asc, unknown last)
drop function if exists public.stars_page(integer, text, text, text, integer, integer, integer, integer);
create or replace function public.stars_page(
  p_fans_lt       integer default null,
  p_topic         text    default null,
  p_q             text    default null,
  p_sort          text    default 'new',
  p_page          integer default 1,
  p_size          integer default 60,
  p_stale_minutes integer default 20,
  p_level_gate    integer default 3,
  p_online        text    default null
)
returns jsonb
language sql
stable
as $$
  with base as (
    select l.uid, l.room_id, l.title, l.cover, l.tags, l.area, l.started_at, l.seen_at,
           l.online_count, l.online_fetched_at,
           b.uname, b.face, b.fans, b.level,
           case
             when l.area ~ '(Singer|唱|歌)'            then '歌'
             when l.area ~ '(Gamer|游戏)'              then '游戏'
             when l.area ~ '(声优|电台)'               then '电台'
             when l.area ~ '(日常|杂谈|男V|虚拟主播)'  then '杂谈'
             else '其他'
           end as topic
    from public.live_now l
    join public.bili_streamer b on b.uid = l.uid
    where l.seen_at > now() - make_interval(mins => p_stale_minutes)
      and b.level >= p_level_gate
      and b.deleted_at is null
      and b.hidden_at is null
      and (p_fans_lt is null or b.fans < p_fans_lt)
      and (p_online is null
           or (p_online = 'le10'  and l.online_count is not null and l.online_count <= 10)
           or (p_online = '11_30' and l.online_count between 11 and 30)
           or (p_online = '31_50' and l.online_count between 31 and 50)
           or (p_online = 'gt50'  and l.online_count > 50))
  ), topic_counts as (
    select topic, count(*)::integer as n,
           array_position(array['杂谈','歌','游戏','电台','其他'], topic) as ord
    from base group by topic
  ), online_counts as (
    select
      count(*) filter (where online_count is not null and online_count <= 10)  as le10,
      count(*) filter (where online_count between 11 and 30)                   as b11_30,
      count(*) filter (where online_count between 31 and 50)                   as b31_50,
      count(*) filter (where online_count > 50)                                as gt50,
      count(*) filter (where online_count is null)                             as unknown
    from base
  ), filtered as (
    select * from base
    where (p_topic is null or topic = p_topic)
      and (p_q is null or p_q = ''
           or uname ilike '%' || p_q || '%'
           or title ilike '%' || p_q || '%'
           or exists (select 1 from unnest(tags) t where t ilike '%' || p_q || '%'))
  ), page as (
    select * from filtered
    order by case when p_sort = 'small'  then fans         end asc nulls last,
             case when p_sort = 'online' then online_count end asc nulls last,
             started_at desc nulls last, uid
    offset greatest(p_page - 1, 0) * p_size
    limit p_size
  )
  select jsonb_build_object(
    'total',      (select count(*) from filtered),
    'topics',     coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'n', n) order by ord) from topic_counts), '[]'::jsonb),
    'online',     (select jsonb_build_object('le10', le10, 'b11_30', b11_30, 'b31_50', b31_50, 'gt50', gt50, 'unknown', unknown) from online_counts),
    'updated_at', (select max(seen_at) from base),
    'rows',       coalesce((select jsonb_agg(jsonb_build_object(
                     'uid', uid, 'room_id', room_id, 'title', title, 'cover', cover, 'tags', tags,
                     'area', area, 'started_at', started_at, 'seen_at', seen_at,
                     'online_count', online_count, 'online_fetched_at', online_fetched_at,
                     'bili_streamer', jsonb_build_object('uname', uname, 'face', face, 'fans', fans, 'level', level)
                   ) order by case when p_sort = 'small'  then fans         end asc nulls last,
                              case when p_sort = 'online' then online_count end asc nulls last,
                              started_at desc nulls last, uid)
                   from page), '[]'::jsonb)
  );
$$;
grant execute on function public.stars_page(integer, text, text, text, integer, integer, integer, integer, text) to anon, authenticated;
