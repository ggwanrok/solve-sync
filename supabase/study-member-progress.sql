create or replace function public.study_member_goal_progress(target_study uuid)
returns table(user_id uuid, solved_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare target_period text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not public.is_study_member(target_study) then raise exception '스터디 멤버만 진행 현황을 볼 수 있습니다.'; end if;
  select goal_period into target_period from study_rooms where id = target_study;

  return query
  select sm.user_id, count(distinct se.problem_id)::bigint
  from study_members sm
  left join solve_events se on se.user_id = sm.user_id
    and se.accepted_at >= case
      when target_period = 'daily' then (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
      else (date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    end
  where sm.study_id = target_study
  group by sm.user_id;
end;
$$;

revoke execute on function public.study_member_goal_progress(uuid) from public, anon;
grant execute on function public.study_member_goal_progress(uuid) to authenticated;
