begin;

alter table public.study_notifications
  add column if not exists read_at timestamptz;

alter table public.study_notifications
  drop constraint if exists study_notifications_type_check;
alter table public.study_notifications
  add constraint study_notifications_type_check
  check (type in ('goal_reminder', 'goal_missed', 'weekly_summary', 'poke'));

create index if not exists study_notifications_recipient_unread
  on public.study_notifications(recipient_id, created_at desc)
  where read_at is null;

drop function if exists public.my_study_notifications(integer);
create function public.my_study_notifications(result_limit integer default 30)
returns table(
  id uuid,
  study_id uuid,
  type text,
  title text,
  body text,
  url text,
  created_at timestamptz,
  read_at timestamptz
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

  return query
  select notification.id, notification.study_id, notification.type,
    notification.title, notification.body, notification.url,
    notification.created_at, notification.read_at
  from public.study_notifications notification
  where notification.recipient_id = auth.uid()
  order by notification.created_at desc, notification.id desc
  limit greatest(1, least(coalesce(result_limit, 30), 50));
end;
$$;

create or replace function public.unread_study_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then 0 else count(*)::integer end
  from public.study_notifications notification
  where notification.recipient_id = auth.uid()
    and notification.read_at is null;
$$;

create or replace function public.mark_study_notifications_read(target_notification uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  update public.study_notifications notification
  set read_at = now()
  where notification.recipient_id = auth.uid()
    and notification.read_at is null
    and (target_notification is null or notification.id = target_notification);
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

drop function if exists public.study_daily_champions(uuid);
create function public.study_daily_champions(target_study uuid)
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
    join public.study_rooms room on room.id = member.study_id
    left join public.solve_events event
      on event.user_id = member.user_id
      and coalesce(event.difficulty, 0) >= room.min_difficulty
      and event.accepted_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
      and event.accepted_at < ((date_trunc('day', now() at time zone 'Asia/Seoul') + interval '1 day') at time zone 'Asia/Seoul')
    where member.study_id = target_study
    group by member.user_id
  ), winning_count as (
    select max(member_solves.solved_count) as solved_count from member_solves
  )
  select profile.id, profile.handle, profile.nickname, profile.avatar_url, member_solves.solved_count
  from member_solves
  join winning_count on winning_count.solved_count = member_solves.solved_count
  join public.profiles profile on profile.id = member_solves.user_id
  where member_solves.solved_count > 0
  order by coalesce(nullif(trim(profile.nickname), ''), profile.handle), profile.id;
end;
$$;

drop function if exists public.claim_study_notifications();
create function public.claim_study_notifications()
returns table(notification_id uuid, recipient_id uuid, notification_type text, title text, body text, url text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 마감 임박 알림은 앱 알림함에는 모든 멤버에게 남기고, 아래 claim 단계에서
  -- 푸시를 켠 멤버만 실제 브라우저 푸시 대상으로 선택한다.
  insert into public.study_notifications(
    study_id, recipient_id, type, title, body, url, deduplication_key
  )
  select candidate.study_id, candidate.user_id, 'goal_reminder', candidate.room_name,
    '목표 마감까지 6시간 남았어요. 달성까지 ' || (candidate.goal_count - candidate.solved_count)::text || '문제 남았습니다.',
    '/study/' || candidate.study_id::text,
    'goal-reminder:' || candidate.study_id::text || ':' || candidate.user_id::text || ':' || extract(epoch from candidate.period_start)::bigint::text
  from (
    select room.id as study_id, room.name as room_name, room.goal_count, member.user_id,
      period.period_start, period.period_end, coalesce(progress.solved_count, 0)::bigint as solved_count
    from public.study_rooms room
    join public.study_members member on member.study_id = room.id
    cross join lateral (
      select
        date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' as period_start,
        (date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, now() at time zone 'Asia/Seoul')
          + case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul' as period_end
    ) period
    left join lateral (
      select count(distinct event.problem_id)::bigint as solved_count
      from public.solve_events event
      where event.user_id = member.user_id
        and coalesce(event.difficulty, 0) >= room.min_difficulty
        and event.accepted_at >= greatest(period.period_start, member.joined_at) and event.accepted_at < period.period_end
    ) progress on true
    where member.joined_at < period.period_end
      and room.created_at < period.period_end
  ) candidate
  where now() >= candidate.period_end - interval '6 hours'
    and now() < candidate.period_end
    and candidate.solved_count < candidate.goal_count
  on conflict(deduplication_key) do nothing;

  -- 직전 목표 기간이 끝났을 때 목표를 놓친 멤버에게만 결과를 남긴다.
  insert into public.study_notifications(
    study_id, recipient_id, type, title, body, url, deduplication_key
  )
  select candidate.study_id, candidate.user_id, 'goal_missed', candidate.room_name,
    '지난 ' || case when candidate.goal_period = 'daily' then '하루' else '주' end ||
      ' 목표를 달성하지 못했어요. ' || candidate.goal_count::text || '문제 중 ' || candidate.solved_count::text || '문제를 해결했습니다.',
    '/study/' || candidate.study_id::text,
    'goal-missed:' || candidate.study_id::text || ':' || candidate.user_id::text || ':' || extract(epoch from candidate.period_start)::bigint::text
  from (
    select room.id as study_id, room.name as room_name, room.goal_period, room.goal_count,
      member.user_id, period.period_start, coalesce(progress.solved_count, 0)::bigint as solved_count
    from public.study_rooms room
    join public.study_members member on member.study_id = room.id
    cross join lateral (
      select
        (date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, now() at time zone 'Asia/Seoul')
          - case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul' as period_start,
        date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' as period_end
    ) period
    left join lateral (
      select count(distinct event.problem_id)::bigint as solved_count
      from public.solve_events event
      where event.user_id = member.user_id
        and coalesce(event.difficulty, 0) >= room.min_difficulty
        and event.accepted_at >= greatest(period.period_start, member.joined_at) and event.accepted_at < period.period_end
    ) progress on true
    where member.joined_at < period.period_end
      and room.created_at < period.period_end
  ) candidate
  where candidate.solved_count < candidate.goal_count
  on conflict(deduplication_key) do nothing;

  -- 주간 스터디는 멤버 전체 결과를 한 문장으로 요약한다.
  insert into public.study_notifications(
    study_id, recipient_id, type, title, body, url, deduplication_key
  )
  select room.id, recipient.user_id, 'weekly_summary', room.name,
    '지난주에는 ' || stats.member_count::text || '명 중 ' || stats.achieved_count::text ||
      '명이 목표를 달성했고, 총 ' || stats.total_solved::text || '문제를 해결했어요.',
    '/study/' || room.id::text,
    'weekly-summary:' || room.id::text || ':' || recipient.user_id::text || ':' || extract(epoch from period.period_start)::bigint::text
  from public.study_rooms room
  join public.study_members recipient on recipient.study_id = room.id
  cross join lateral (
    select
      (date_trunc('week', now() at time zone 'Asia/Seoul') - interval '1 week') at time zone 'Asia/Seoul' as period_start,
      date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' as period_end
  ) period
  cross join lateral (
    select count(*)::integer as member_count,
      count(*) filter (where result.solved_count >= room.goal_count)::integer as achieved_count,
      coalesce(sum(result.solved_count), 0)::bigint as total_solved
    from (
      select member.user_id, count(distinct event.problem_id)::bigint as solved_count
      from public.study_members member
      left join public.solve_events event
        on event.user_id = member.user_id
        and coalesce(event.difficulty, 0) >= room.min_difficulty
        and event.accepted_at >= greatest(period.period_start, member.joined_at) and event.accepted_at < period.period_end
      where member.study_id = room.id
        and member.joined_at < period.period_end
      group by member.user_id
    ) result
  ) stats
  where room.goal_period = 'weekly'
    and room.created_at < period.period_end
    and recipient.joined_at < period.period_end
  on conflict(deduplication_key) do nothing;

  return query
  update public.study_notifications notification
  set push_attempted_at = now()
  where notification.type in ('goal_reminder', 'goal_missed', 'weekly_summary')
    and notification.pushed_at is null
    and notification.created_at >= now() - interval '8 days'
    and (notification.push_attempted_at is null or notification.push_attempted_at < now() - interval '30 minutes')
    and exists(
      select 1 from public.study_members member
      where member.study_id = notification.study_id
        and member.user_id = notification.recipient_id
        and member.notifications_enabled
    )
    and exists(
      select 1 from public.push_subscriptions subscription
      where subscription.user_id = notification.recipient_id
    )
  returning notification.id, notification.recipient_id, notification.type,
    notification.title, notification.body, notification.url;
end;
$$;

revoke execute on function public.my_study_notifications(integer) from public, anon;
grant execute on function public.my_study_notifications(integer) to authenticated;
revoke execute on function public.unread_study_notification_count() from public, anon;
grant execute on function public.unread_study_notification_count() to authenticated;
revoke execute on function public.mark_study_notifications_read(uuid) from public, anon;
grant execute on function public.mark_study_notifications_read(uuid) to authenticated;
revoke execute on function public.study_daily_champions(uuid) from public, anon;
grant execute on function public.study_daily_champions(uuid) to authenticated;
revoke execute on function public.claim_study_notifications() from public, anon, authenticated;
grant execute on function public.claim_study_notifications() to service_role;

commit;
