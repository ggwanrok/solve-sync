begin;

create or replace function public.study_member_solve_events(target_study uuid)
returns table(
  period_start timestamptz,
  period_end timestamptz,
  is_current boolean,
  user_id uuid,
  problem_id text,
  title text,
  url text,
  language text,
  accepted_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare target_period text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if not public.is_study_member(target_study) then raise exception '스터디 멤버만 풀이 상세를 볼 수 있습니다.'; end if;

  select room.goal_period into target_period
  from study_rooms room
  where room.id = target_study;

  return query
  with periodized_events as (
    select
      event.user_id,
      event.problem_id,
      event.title,
      event.url,
      event.language,
      event.accepted_at,
      date_trunc(case when target_period = 'daily' then 'day' else 'week' end, event.accepted_at at time zone 'Asia/Seoul') as period_local
    from solve_events event
  )
  select
    event.period_local at time zone 'Asia/Seoul' as period_start,
    (event.period_local + case when target_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul' as period_end,
    now() >= (event.period_local at time zone 'Asia/Seoul')
      and now() < ((event.period_local + case when target_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul') as is_current,
    event.user_id,
    event.problem_id,
    event.title,
    event.url,
    event.language,
    event.accepted_at
  from periodized_events event
  where exists (
    select 1
    from study_membership_history history
    where history.study_id = target_study
      and history.user_id = event.user_id
      and history.joined_at < ((event.period_local + case when target_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul')
      and coalesce(history.left_at, 'infinity'::timestamptz) > (event.period_local at time zone 'Asia/Seoul')
  )
  order by event.accepted_at desc;
end;
$$;

revoke execute on function public.study_member_solve_events(uuid) from public, anon;
grant execute on function public.study_member_solve_events(uuid) to authenticated;

commit;
