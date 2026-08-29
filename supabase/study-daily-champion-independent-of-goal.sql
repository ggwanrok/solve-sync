-- 오늘의 풀이왕은 스터디 목표 개수와 최소 난이도 조건에 관계없이
-- 오늘 해결한 전체 문제 수가 가장 많은 멤버를 표시한다.
create or replace function public.study_daily_champions(target_study uuid)
returns table(
  user_id uuid,
  handle text,
  nickname text,
  avatar_url text,
  solved_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not exists(
    select 1 from public.study_members member
    where member.study_id = target_study and member.user_id = auth.uid()
  ) then
    return;
  end if;

  return query
  with member_solves as (
    select member.user_id, count(distinct event.problem_id)::bigint as solved_count
    from public.study_members member
    left join public.solve_events event
      on event.user_id = member.user_id
      and event.accepted_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
      and event.accepted_at < ((date_trunc('day', now() at time zone 'Asia/Seoul') + interval '1 day') at time zone 'Asia/Seoul')
    where member.study_id = target_study
    group by member.user_id
  ), ranked_members as (
    select member_solves.*, dense_rank() over(order by member_solves.solved_count desc) as solve_rank
    from member_solves
  )
  select profile.id, profile.handle, profile.nickname, profile.avatar_url, ranked_members.solved_count
  from ranked_members
  join public.profiles profile on profile.id = ranked_members.user_id
  where ranked_members.solve_rank = 1
    and ranked_members.solved_count > 0
  order by coalesce(nullif(trim(profile.nickname), ''), profile.handle), profile.id;
end;
$$;

revoke execute on function public.study_daily_champions(uuid) from public, anon;
grant execute on function public.study_daily_champions(uuid) to authenticated;
