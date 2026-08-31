begin;

-- 과거 정리 알림은 알림함 기록으로 유지하고, 이후 스케줄 실행에서만 생성과 발송을 중단한다.
create or replace function public.claim_study_notifications(notification_phase text default 'reminder')
returns table(notification_id uuid, recipient_id uuid, notification_type text, title text, body text, url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_run_at timestamp := now() at time zone 'Asia/Seoul';
begin
  if notification_phase not in ('reminder', 'briefing') then
    raise exception '알림 실행 단계를 확인해 주세요.' using errcode = '22023';
  end if;

  if notification_phase = 'reminder' then
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
          date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, local_run_at) at time zone 'Asia/Seoul' as period_start,
          (date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, local_run_at)
            + case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul' as period_end
      ) period
      left join lateral (
        select count(distinct event.problem_id)::bigint as solved_count
        from public.solve_events event
        where event.user_id = member.user_id
          and coalesce(event.difficulty, 0) >= room.min_difficulty
          and event.accepted_at >= greatest(period.period_start, member.joined_at)
          and event.accepted_at < period.period_end
      ) progress on true
      where member.joined_at < period.period_end
        and room.created_at < period.period_end
    ) candidate
    where now() >= candidate.period_end - interval '6 hours'
      and now() < candidate.period_end
      and candidate.solved_count < candidate.goal_count
    on conflict(deduplication_key) do nothing;
  else
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
        member.user_id, period.period_start, period.period_end, coalesce(progress.solved_count, 0)::bigint as solved_count
      from public.study_rooms room
      join public.study_members member on member.study_id = room.id
      cross join lateral (
        select
          (date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, local_run_at)
            - case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul' as period_start,
          date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, local_run_at) at time zone 'Asia/Seoul' as period_end
      ) period
      left join lateral (
        select count(distinct event.problem_id)::bigint as solved_count
        from public.solve_events event
        where event.user_id = member.user_id
          and coalesce(event.difficulty, 0) >= room.min_difficulty
          and event.accepted_at >= greatest(period.period_start, member.joined_at)
          and event.accepted_at < period.period_end
      ) progress on true
      where (room.goal_period = 'daily'
          or (room.goal_period = 'weekly' and extract(isodow from local_run_at) = 1))
        and member.joined_at < period.period_end
        and room.created_at < period.period_end
    ) candidate
    where candidate.solved_count < candidate.goal_count
    on conflict(deduplication_key) do nothing;
  end if;

  return query
  update public.study_notifications notification
  set push_attempted_at = now()
  where ((notification_phase = 'reminder' and notification.type = 'goal_reminder')
      or (notification_phase = 'briefing' and notification.type = 'goal_missed'))
    and notification.pushed_at is null
    and notification.created_at >= now() - interval '12 hours'
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

revoke execute on function public.claim_study_notifications(text) from public, anon, authenticated;
grant execute on function public.claim_study_notifications(text) to service_role;

commit;
