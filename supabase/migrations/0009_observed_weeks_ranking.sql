-- Tenkyu — observed weeks (trust axis) and the board's ranking order.
-- Apply in Supabase → SQL Editor after 0008_online_count.sql.
--
-- weeks_observed = number of distinct calendar weeks (Asia/Shanghai, Monday start) in the
-- last `window_weeks` in which the collector saw the room live at least once. One point per
-- week at most, so streaming intensity cannot raise it; only span can. Refreshed by the
-- collector through refresh_observed_weeks().

alter table public.bili_streamer add column if not exists weeks_observed smallint not null default 0;
alter table public.bili_streamer add column if not exists weeks_computed_at timestamptz;
create index if not exists bili_streamer_weeks_idx on public.bili_streamer (weeks_observed desc);

create or replace function public.refresh_observed_weeks(window_weeks integer default 26)
returns integer
language sql
as $$
  with weeks as (
    select uid, date_trunc('week', (started_at at time zone 'Asia/Shanghai'))::date as wk
    from public.live_session
    where started_at > now() - make_interval(weeks => window_weeks)
    union
    select uid, date_trunc('week', (coalesce(started_at, seen_at) at time zone 'Asia/Shanghai'))::date
    from public.live_now
  ), counts as (
    select uid, count(distinct wk)::smallint as n from weeks group by uid
  ), upd as (
    update public.bili_streamer b
    set weeks_observed = coalesce(c.n, 0),
        weeks_computed_at = now()
    from (select b2.uid, c2.n from public.bili_streamer b2 left join counts c2 on c2.uid = b2.uid) c
    where c.uid = b.uid
      and (b.weeks_observed <> coalesce(c.n, 0) or b.weeks_computed_at is null)
    returning 1
  )
  select count(*)::integer from upd;
$$;
revoke all on function public.refresh_observed_weeks(integer) from public, anon, authenticated;

-- Board ranking. p_sort:
--   'rank'   (default) tier by weeks_observed (>= 8 → 3, 4–7 → 2, 1–3 → 1, else 0) desc,
--            rooms with online_count = 0 sink, then a stable shuffle keyed by p_seed
--            (the collector's sweep id → the order is fixed for ~10 min and cacheable)
--   'online' online_count asc (unknown last)   'small' fans asc   'new' started_at desc
drop function if exists public.stars_page(integer, text, text, text, integer, integer, integer, integer, text);
create or replace function public.stars_page(
  p_fans_lt       integer default null,
  p_topic         text    default null,
  p_q             text    default null,
  p_sort          text    default 'rank',
  p_page          integer default 1,
  p_size          integer default 60,
  p_stale_minutes integer default 20,
  p_level_gate    integer default 3,
  p_online        text    default null,
  p_seed          integer default 0
)
returns jsonb
language sql
stable
as $$
  with base as (
    select l.uid, l.room_id, l.title, l.cover, l.tags, l.area, l.started_at, l.seen_at,
           l.online_count, l.online_fetched_at,
           b.uname, b.face, b.fans, b.level, b.weeks_observed,
           case when b.weeks_observed >= 8 then 3 when b.weeks_observed >= 4 then 2 when b.weeks_observed >= 1 then 1 else 0 end as tier,
           case when l.online_count = 0 then 1 else 0 end as sink,
           hashtext(l.uid::text || ':' || p_seed::text) as shuffle,
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
  ), ordered as (
    select *, row_number() over (
      order by case when p_sort = 'rank'   then tier         end desc nulls last,
               case when p_sort = 'rank'   then sink         end asc,
               case when p_sort = 'rank'   then shuffle      end asc,
               case when p_sort = 'small'  then fans         end asc nulls last,
               case when p_sort = 'online' then online_count end asc nulls last,
               started_at desc nulls last, uid
    ) as rn
    from filtered
  ), page as (
    select * from ordered
    where rn > greatest(p_page - 1, 0) * p_size and rn <= greatest(p_page - 1, 0) * p_size + p_size
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
                     'weeks_observed', weeks_observed,
                     'bili_streamer', jsonb_build_object('uname', uname, 'face', face, 'fans', fans, 'level', level)
                   ) order by rn) from page), '[]'::jsonb)
  );
$$;
grant execute on function public.stars_page(integer, text, text, text, integer, integer, integer, integer, text, integer) to anon, authenticated;
