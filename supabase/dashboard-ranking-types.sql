begin;

-- 합산 랭킹을 유형별 랭킹으로 교체한다. 유형 생략 시 알고리즘을 반환한다.
drop function if exists public.dashboard_ranking(integer);
drop function if exists public.dashboard_ranking_page(integer);
create or replace function public.dashboard_ranking_page(page_number integer default 1, ranking_type text default 'algorithm')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_type as (
    select case when ranking_type = 'sql' then 'sql' else 'algorithm' end as problem_type
  ), difficulty_ranked as (
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
      coalesce(max(aggregate.total_solved) filter (where aggregate.problem_type = 'sql'), 0)::bigint as sql_solved
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
      coalesce(selected.type_score, 0)::bigint as ranking_score,
      coalesce(aggregate.algorithm_score, 0)::bigint as algorithm_score,
      coalesce(aggregate.sql_score, 0)::bigint as sql_score,
      coalesce(aggregate.algorithm_solved, 0)::bigint as algorithm_solved,
      coalesce(aggregate.sql_solved, 0)::bigint as sql_solved,
      coalesce(selected.total_solved, 0)::bigint as total_solved,
      coalesce(selected.level_0_solved, 0)::bigint as level_0_solved,
      coalesce(selected.level_1_solved, 0)::bigint as level_1_solved,
      coalesce(selected.level_2_solved, 0)::bigint as level_2_solved,
      coalesce(selected.level_3_solved, 0)::bigint as level_3_solved,
      coalesce(selected.level_4_solved, 0)::bigint as level_4_solved,
      coalesce(selected.level_5_solved, 0)::bigint as level_5_solved,
      coalesce(selected.unknown_solved, 0)::bigint as unknown_solved
    from public.profiles profile
    left join user_aggregates aggregate on aggregate.user_id = profile.id
    left join type_aggregates selected on selected.user_id = profile.id
      and selected.problem_type = (select problem_type from selected_type)
    where profile.handle is not null
  ),
  ranked as (
    select
      row_number() over (
        order by score.ranking_score desc, score.total_solved desc, score.handle asc
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

revoke execute on function public.dashboard_ranking_page(integer, text) from public, anon;
grant execute on function public.dashboard_ranking_page(integer, text) to authenticated;

commit;
