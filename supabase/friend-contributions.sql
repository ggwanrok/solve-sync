begin;

drop function if exists public.friend_contribution_events(date);
create function public.friend_contribution_events(first_date date)
returns table(
  friend_id uuid,
  title text,
  language text,
  difficulty smallint,
  accepted_at timestamptz,
  problem_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      (current_timestamp at time zone 'Asia/Seoul')::date as today,
      greatest(
        coalesce(first_date, (current_timestamp at time zone 'Asia/Seoul')::date - 111),
        (current_timestamp at time zone 'Asia/Seoul')::date - 111
      ) as first_day
  )
  select
    event.user_id as friend_id,
    event.title,
    event.language,
    event.difficulty,
    event.accepted_at,
    event.problem_id
  from bounds
  join public.friendships friendship
    on friendship.user_id = (select auth.uid())
  join public.solve_events event
    on event.user_id = friendship.friend_id
  where (select auth.uid()) is not null
    and event.problem_type = 'algorithm'
    and event.accepted_at >= (bounds.first_day::timestamp at time zone 'Asia/Seoul')
    and event.accepted_at < ((bounds.today + 1)::timestamp at time zone 'Asia/Seoul')
  order by event.user_id, event.accepted_at;
$$;

revoke execute on function public.friend_contribution_events(date) from public, anon;
grant execute on function public.friend_contribution_events(date) to authenticated;

commit;
