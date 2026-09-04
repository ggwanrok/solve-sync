begin;

-- 대시보드 목록은 필요한 10개만 반환하고, 전체 통계는 행 개수 제한 없이 집계한다.
create index if not exists solve_events_user_accepted_id
  on public.solve_events(user_id, accepted_at desc, id desc);

create or replace function public.dashboard_solves_page(page_number integer default 1)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with totals as (
    select count(*) as total_count
    from public.solve_events event
    where event.user_id = (select auth.uid())
  ), paging as (
    select total_count,
      least(greatest(coalesce(page_number, 1), 1)::bigint, greatest((total_count + 9) / 10, 1)) as page
    from totals
  ), page_entries as (
    select event.id, event.problem_id, event.title, event.url, event.language,
      event.problem_type, event.difficulty, event.accepted_at
    from public.solve_events event
    where event.user_id = (select auth.uid())
    order by event.accepted_at desc, event.id desc
    limit 10 offset (select (page - 1) * 10 from paging)
  )
  select jsonb_build_object(
    'entries', coalesce((select jsonb_agg(to_jsonb(entry) order by entry.accepted_at desc, entry.id desc) from page_entries entry), '[]'::jsonb),
    'page', paging.page,
    'totalCount', paging.total_count
  )
  from paging;
$$;

create or replace function public.dashboard_solve_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with viewer_events as materialized (
    select (event.accepted_at at time zone 'Asia/Seoul')::date as solved_day
    from public.solve_events event
    where event.user_id = (select auth.uid())
  ), solved_days as (
    select distinct solved_day from viewer_events
    where solved_day <= (now() at time zone 'Asia/Seoul')::date
  ), ordered_days as (
    select solved_day, row_number() over (order by solved_day desc) as day_position,
      max(solved_day) over () as latest_day
    from solved_days
  )
  select jsonb_build_object(
    'totalSolved', (select count(*) from viewer_events),
    'currentStreak', (
      select count(*) from ordered_days
      where latest_day >= (now() at time zone 'Asia/Seoul')::date - 1
        and solved_day = latest_day - (day_position - 1)::integer
    )
  );
$$;

-- 기존 랭킹과 동일한 점수 및 동점 정렬을 사용하며 페이지 범위와 내 랭킹을 함께 반환한다.
create or replace function public.dashboard_ranking_page(page_number integer default 1)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with difficulty_ranked as (
    select
      event.user_id,
      event.problem_type,
      event.difficulty,
      row_number() over (
        partition by event.user_id, event.problem_type
        order by event.difficulty desc nulls last, event.accepted_at asc, event.id asc
      ) as difficulty_position
    from public.solve_events event
    where event.problem_type in ('algorithm', 'sql')
  ),
  type_aggregates as (
    select
      solve.user_id,
      solve.problem_type,
      count(*)::bigint as total_solved,
      (
        coalesce(sum(
          case
            when solve.difficulty_position <= 100 and solve.difficulty is not null
              then case solve.difficulty
                when 0 then 5
                when 1 then 8
                when 2 then 13
                when 3 then 21
                when 4 then 34
                when 5 then 55
                else 0
              end
            else 0
          end
        ), 0)
        + round(200 * (1 - power(0.997::numeric, count(*)::numeric)))
      )::bigint as type_score,
      count(*) filter (where solve.difficulty = 0)::bigint as level_0_solved,
      count(*) filter (where solve.difficulty = 1)::bigint as level_1_solved,
      count(*) filter (where solve.difficulty = 2)::bigint as level_2_solved,
      count(*) filter (where solve.difficulty = 3)::bigint as level_3_solved,
      count(*) filter (where solve.difficulty = 4)::bigint as level_4_solved,
      count(*) filter (where solve.difficulty = 5)::bigint as level_5_solved,
      count(*) filter (where solve.difficulty is null)::bigint as unknown_solved
    from difficulty_ranked solve
    group by solve.user_id, solve.problem_type
  ),
  user_aggregates as (
    select
      aggregate.user_id,
      coalesce(max(aggregate.type_score) filter (where aggregate.problem_type = 'algorithm'), 0)::bigint as algorithm_score,
      coalesce(max(aggregate.type_score) filter (where aggregate.problem_type = 'sql'), 0)::bigint as sql_score,
      coalesce(max(aggregate.total_solved) filter (where aggregate.problem_type = 'algorithm'), 0)::bigint as algorithm_solved,
      coalesce(max(aggregate.total_solved) filter (where aggregate.problem_type = 'sql'), 0)::bigint as sql_solved,
      coalesce(sum(aggregate.total_solved), 0)::bigint as total_solved,
      coalesce(sum(aggregate.level_0_solved), 0)::bigint as level_0_solved,
      coalesce(sum(aggregate.level_1_solved), 0)::bigint as level_1_solved,
      coalesce(sum(aggregate.level_2_solved), 0)::bigint as level_2_solved,
      coalesce(sum(aggregate.level_3_solved), 0)::bigint as level_3_solved,
      coalesce(sum(aggregate.level_4_solved), 0)::bigint as level_4_solved,
      coalesce(sum(aggregate.level_5_solved), 0)::bigint as level_5_solved,
      coalesce(sum(aggregate.unknown_solved), 0)::bigint as unknown_solved
    from type_aggregates aggregate
    group by aggregate.user_id
  ),
  scores as (
    select
      profile.id as user_id,
      profile.handle,
      profile.nickname,
      profile.bio,
      profile.avatar_url,
      (
        coalesce(aggregate.algorithm_score, 0)
        + coalesce(aggregate.sql_score, 0) / 2
      )::bigint as ranking_score,
      coalesce(aggregate.algorithm_score, 0)::bigint as algorithm_score,
      coalesce(aggregate.sql_score, 0)::bigint as sql_score,
      coalesce(aggregate.algorithm_solved, 0)::bigint as algorithm_solved,
      coalesce(aggregate.sql_solved, 0)::bigint as sql_solved,
      coalesce(aggregate.total_solved, 0)::bigint as total_solved,
      coalesce(aggregate.level_0_solved, 0)::bigint as level_0_solved,
      coalesce(aggregate.level_1_solved, 0)::bigint as level_1_solved,
      coalesce(aggregate.level_2_solved, 0)::bigint as level_2_solved,
      coalesce(aggregate.level_3_solved, 0)::bigint as level_3_solved,
      coalesce(aggregate.level_4_solved, 0)::bigint as level_4_solved,
      coalesce(aggregate.level_5_solved, 0)::bigint as level_5_solved,
      coalesce(aggregate.unknown_solved, 0)::bigint as unknown_solved
    from public.profiles profile
    left join user_aggregates aggregate on aggregate.user_id = profile.id
    where profile.handle is not null
  ),
  ranked as (
    select
      row_number() over (
        order by score.ranking_score desc, score.algorithm_score desc, score.sql_score desc,
          score.total_solved desc, score.handle asc
      ) as ranking_position,
      score.*
    from scores score
  ),
  paging as (
    select count(*) as total_count,
      least(greatest(coalesce(page_number, 1), 1)::bigint, greatest((count(*) + 9) / 10, 1)) as page
    from ranked
  )
  select jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.ranking_position)
      from ranked entry
      where entry.ranking_position > (paging.page - 1) * 10
        and entry.ranking_position <= paging.page * 10
    ), '[]'::jsonb),
    'viewer', (select to_jsonb(viewer) from ranked viewer where viewer.user_id = (select auth.uid())),
    'page', paging.page,
    'totalCount', paging.total_count
  )
  from paging
  where (select auth.uid()) is not null;
$$;

revoke execute on function public.dashboard_solves_page(integer) from public, anon;
revoke execute on function public.dashboard_solve_summary() from public, anon;
revoke execute on function public.dashboard_ranking_page(integer) from public, anon;
grant execute on function public.dashboard_solves_page(integer) to authenticated;
grant execute on function public.dashboard_solve_summary() to authenticated;
grant execute on function public.dashboard_ranking_page(integer) to authenticated;

commit;
