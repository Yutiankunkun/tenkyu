-- Observatory board query as ONE database call: gate, band, topic, search, sort and
-- pagination happen in Postgres; the web app receives one page of JSON.
-- Apply in Supabase → SQL Editor after 0005_indexes.sql.

create or replace function public.stars_page(
  p_fans_lt       integer default null,   -- null = all bands
  p_topic         text    default null,   -- 杂谈 / 歌 / 游戏 / 电台 / 其他
  p_q             text    default null,   -- substring on uname, title, tags (caller escapes % _)
  p_sort          text    default 'new',  -- 'new' (started_at desc) | 'small' (fans asc)
  p_page          integer default 1,
  p_size          integer default 60,
  p_stale_minutes integer default 20,
  p_level_gate    integer default 3
)
returns jsonb
language sql
stable
as $$
  with base as (
    select l.uid, l.room_id, l.title, l.cover, l.tags, l.area, l.started_at, l.seen_at,
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
      and (p_fans_lt is null or b.fans < p_fans_lt)
  ), topic_counts as (
    select topic, count(*)::integer as n,
           array_position(array['杂谈','歌','游戏','电台','其他'], topic) as ord
    from base group by topic
  ), filtered as (
    select * from base
    where (p_topic is null or topic = p_topic)
      and (p_q is null or p_q = ''
           or uname ilike '%' || p_q || '%'
           or title ilike '%' || p_q || '%'
           or exists (select 1 from unnest(tags) t where t ilike '%' || p_q || '%'))
  ), page as (
    select * from filtered
    order by case when p_sort = 'small' then fans end asc nulls last,
             started_at desc nulls last, uid
    offset greatest(p_page - 1, 0) * p_size
    limit p_size
  )
  select jsonb_build_object(
    'total',      (select count(*) from filtered),
    'topics',     coalesce((select jsonb_agg(jsonb_build_object('topic', topic, 'n', n) order by ord) from topic_counts), '[]'::jsonb),
    'updated_at', (select max(seen_at) from base),
    'rows',       coalesce((select jsonb_agg(jsonb_build_object(
                     'uid', uid, 'room_id', room_id, 'title', title, 'cover', cover, 'tags', tags,
                     'area', area, 'started_at', started_at, 'seen_at', seen_at,
                     'bili_streamer', jsonb_build_object('uname', uname, 'face', face, 'fans', fans, 'level', level)
                   ) order by case when p_sort = 'small' then fans end asc nulls last, started_at desc nulls last, uid)
                   from page), '[]'::jsonb)
  );
$$;

grant execute on function public.stars_page(integer, text, text, text, integer, integer, integer, integer) to anon, authenticated;
