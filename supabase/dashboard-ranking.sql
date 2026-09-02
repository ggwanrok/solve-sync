begin;

drop function if exists public.dashboard_ranking(integer);
create function public.dashboard_ranking(top_limit integer default 10)
returns table(
  ranking_position bigint,
  user_id uuid,
  handle text,
  nickname text,
  bio text,
  avatar_url text,
  ranking_score bigint,
  algorithm_score bigint,
  sql_score bigint,
  algorithm_solved bigint,
  sql_solved bigint,
  total_solved bigint,
  level_0_solved bigint,
  level_1_solved bigint,
  level_2_solved bigint,
  level_3_solved bigint,
  level_4_solved bigint,
  level_5_solved bigint,
  unknown_solved bigint
)
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
  )
  select
    ranked.ranking_position,
    ranked.user_id,
    ranked.handle,
    ranked.nickname,
    ranked.bio,
    ranked.avatar_url,
    ranked.ranking_score,
    ranked.algorithm_score,
    ranked.sql_score,
    ranked.algorithm_solved,
    ranked.sql_solved,
    ranked.total_solved,
    ranked.level_0_solved,
    ranked.level_1_solved,
    ranked.level_2_solved,
    ranked.level_3_solved,
    ranked.level_4_solved,
    ranked.level_5_solved,
    ranked.unknown_solved
  from ranked
  where (select auth.uid()) is not null
    and (
      ranked.ranking_position <= least(greatest(coalesce(top_limit, 10), 1), 100)
      or ranked.user_id = (select auth.uid())
    )
  order by ranked.ranking_position;
$$;

revoke execute on function public.dashboard_ranking(integer) from public, anon;
grant execute on function public.dashboard_ranking(integer) to authenticated;

commit;
