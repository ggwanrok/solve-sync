begin;

alter table public.study_members
  add column if not exists notifications_enabled boolean not null default false;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id
  on public.push_subscriptions(user_id);

create table if not exists public.study_notifications (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_rooms(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('goal_reminder', 'poke')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 300),
  url text not null,
  deduplication_key text not null unique,
  push_attempted_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists study_notifications_recipient_created_at
  on public.study_notifications(recipient_id, created_at desc);
create index if not exists study_notifications_poke_sender_created_at
  on public.study_notifications(sender_id, recipient_id, study_id, created_at desc)
  where type = 'poke';
create index if not exists study_notifications_pending_push
  on public.study_notifications(created_at)
  where pushed_at is null;

create or replace function public.set_study_notifications(target_study uuid, enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if enabled and not exists(
    select 1 from public.push_subscriptions subscription
    where subscription.user_id = current_user_id
  ) then
    raise exception '먼저 브라우저 알림을 허용해 주세요.';
  end if;

  update public.study_members member
  set notifications_enabled = enabled
  where member.study_id = target_study
    and member.user_id = current_user_id;

  if not found then
    raise exception '참여 중인 스터디룸이 아닙니다.';
  end if;
  return enabled;
end;
$$;

drop function if exists public.study_room_notification_settings(uuid);
create function public.study_room_notification_settings(target_study uuid)
returns table(user_id uuid, notifications_enabled boolean, last_poked_at timestamptz)
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
  select member.user_id, member.notifications_enabled, poke.last_poked_at
  from public.study_members member
  left join lateral (
    select max(notification.created_at) as last_poked_at
    from public.study_notifications notification
    where notification.type = 'poke'
      and notification.study_id = target_study
      and notification.sender_id = auth.uid()
      and notification.recipient_id = member.user_id
      and notification.created_at > now() - interval '10 minutes'
  ) poke on true
  where member.study_id = target_study
  order by member.joined_at, member.user_id;
end;
$$;

create or replace function public.create_study_poke(target_study uuid, target_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_room record;
  sender_enabled boolean;
  receiver_enabled boolean;
  sender_name text;
  period_start timestamptz;
  period_end timestamptz;
  solved_count bigint;
  day_start timestamptz;
  notification_id uuid := gen_random_uuid();
  notification_title text;
  notification_body text;
  notification_url text;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if target_user is null or target_user = current_user_id then
    raise exception '자기 자신은 콕 찌를 수 없습니다.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('study-poke:' || least(current_user_id::text, target_user::text), 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('study-poke:' || greatest(current_user_id::text, target_user::text), 0)
  );

  select room.id, room.name, room.goal_period, room.goal_count, room.min_difficulty
  into target_room
  from public.study_rooms room
  where room.id = target_study;
  if target_room.id is null then
    raise exception '존재하지 않는 스터디룸입니다.';
  end if;

  select member.notifications_enabled
  into sender_enabled
  from public.study_members member
  where member.study_id = target_study and member.user_id = current_user_id;
  if not found then
    raise exception '참여 중인 스터디룸이 아닙니다.';
  end if;

  select member.notifications_enabled
  into receiver_enabled
  from public.study_members member
  where member.study_id = target_study and member.user_id = target_user;
  if not found then
    raise exception '상대방이 이 스터디에 참여하고 있지 않습니다.';
  end if;
  if not sender_enabled or not receiver_enabled then
    raise exception '서로 이 스터디의 알림을 켜야 콕 찌를 수 있습니다.';
  end if;
  if not exists(
    select 1 from public.push_subscriptions subscription
    where subscription.user_id = target_user
  ) then
    raise exception '상대방의 브라우저 알림 연결이 만료되었습니다.';
  end if;

  period_start := date_trunc(
    case when target_room.goal_period = 'daily' then 'day' else 'week' end,
    now() at time zone 'Asia/Seoul'
  ) at time zone 'Asia/Seoul';
  period_end := (
    period_start at time zone 'Asia/Seoul'
    + case when target_room.goal_period = 'daily' then interval '1 day' else interval '1 week' end
  ) at time zone 'Asia/Seoul';

  select count(distinct event.problem_id)::bigint
  into solved_count
  from public.solve_events event
  where event.user_id = target_user
    and coalesce(event.difficulty, 0) >= target_room.min_difficulty
    and event.accepted_at >= period_start
    and event.accepted_at < period_end;
  if solved_count >= target_room.goal_count then
    raise exception '이미 이번 목표를 달성한 멤버입니다.';
  end if;

  if exists(
    select 1 from public.study_notifications notification
    where notification.type = 'poke'
      and notification.study_id = target_study
      and notification.sender_id = current_user_id
      and notification.recipient_id = target_user
      and notification.created_at > now() - interval '10 minutes'
  ) then
    raise exception '같은 멤버는 10분에 한 번만 콕 찌를 수 있습니다.';
  end if;

  day_start := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  if (
    select count(*) from public.study_notifications notification
    where notification.type = 'poke'
      and notification.sender_id = current_user_id
      and notification.created_at >= day_start
  ) >= 10 then
    raise exception '오늘 보낼 수 있는 콕 찌르기를 모두 사용했습니다.';
  end if;
  if (
    select count(*) from public.study_notifications notification
    where notification.type = 'poke'
      and notification.recipient_id = target_user
      and notification.created_at >= day_start
  ) >= 5 then
    raise exception '상대방이 오늘 받을 수 있는 콕 찌르기를 모두 받았습니다.';
  end if;

  select coalesce(nullif(trim(profile.nickname), ''), nullif(profile.handle, ''), '스터디원')
  into sender_name
  from public.profiles profile
  where profile.id = current_user_id;

  notification_title := target_room.name;
  notification_body := sender_name || '님이 회원님을 콕 찔렀습니다.';
  notification_url := '/study/' || target_study::text;

  insert into public.study_notifications(
    id, study_id, recipient_id, sender_id, type, title, body, url, deduplication_key, push_attempted_at
  ) values (
    notification_id, target_study, target_user, current_user_id, 'poke', notification_title,
    notification_body, notification_url, 'poke:' || notification_id::text, now()
  );

  return jsonb_build_object(
    'id', notification_id,
    'recipientId', target_user,
    'title', notification_title,
    'body', notification_body,
    'url', notification_url
  );
end;
$$;

create or replace function public.claim_study_goal_reminders()
returns table(notification_id uuid, recipient_id uuid, title text, body text, url text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.study_notifications(
    study_id, recipient_id, type, title, body, url, deduplication_key
  )
  select
    candidate.study_id,
    candidate.user_id,
    'goal_reminder',
    candidate.room_name,
    '목표 마감까지 6시간 남았어요. 달성까지 ' || (candidate.goal_count - candidate.solved_count)::text || '문제 남았습니다.',
    '/study/' || candidate.study_id::text,
    'goal-reminder:' || candidate.study_id::text || ':' || candidate.user_id::text || ':' || extract(epoch from candidate.period_start)::bigint::text
  from (
    select
      room.id as study_id,
      room.name as room_name,
      room.goal_count,
      member.user_id,
      period.period_start,
      coalesce(progress.solved_count, 0)::bigint as solved_count
    from public.study_rooms room
    join public.study_members member
      on member.study_id = room.id and member.notifications_enabled
    cross join lateral (
      select
        date_trunc(
          case when room.goal_period = 'daily' then 'day' else 'week' end,
          now() at time zone 'Asia/Seoul'
        ) at time zone 'Asia/Seoul' as period_start,
        (
          date_trunc(
            case when room.goal_period = 'daily' then 'day' else 'week' end,
            now() at time zone 'Asia/Seoul'
          ) + case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end
        ) at time zone 'Asia/Seoul' as period_end
    ) period
    left join lateral (
      select count(distinct event.problem_id)::bigint as solved_count
      from public.solve_events event
      where event.user_id = member.user_id
        and coalesce(event.difficulty, 0) >= room.min_difficulty
        and event.accepted_at >= period.period_start
        and event.accepted_at < period.period_end
    ) progress on true
    where now() >= period.period_end - interval '6 hours'
      and now() < period.period_end
      and coalesce(progress.solved_count, 0) < room.goal_count
      and exists(
        select 1 from public.push_subscriptions subscription
        where subscription.user_id = member.user_id
      )
  ) candidate
  on conflict(deduplication_key) do nothing;

  return query
  update public.study_notifications notification
  set push_attempted_at = now()
  where notification.type = 'goal_reminder'
    and notification.pushed_at is null
    and notification.created_at >= now() - interval '6 hours'
    and (
      notification.push_attempted_at is null
      or notification.push_attempted_at < now() - interval '30 minutes'
    )
    and exists(
      select 1 from public.push_subscriptions subscription
      where subscription.user_id = notification.recipient_id
    )
  returning notification.id, notification.recipient_id, notification.title, notification.body, notification.url;
end;
$$;

alter table public.push_subscriptions enable row level security;
alter table public.study_notifications enable row level security;

revoke all on public.study_members from authenticated;
grant select(study_id, user_id, role, joined_at) on public.study_members to authenticated;
revoke all on public.push_subscriptions from public, anon, authenticated;
revoke all on public.study_notifications from public, anon, authenticated;
grant all on public.push_subscriptions, public.study_notifications to service_role;

revoke execute on function public.set_study_notifications(uuid, boolean) from public, anon;
grant execute on function public.set_study_notifications(uuid, boolean) to authenticated;
revoke execute on function public.study_room_notification_settings(uuid) from public, anon;
grant execute on function public.study_room_notification_settings(uuid) to authenticated;
revoke execute on function public.create_study_poke(uuid, uuid) from public, anon;
grant execute on function public.create_study_poke(uuid, uuid) to authenticated;
revoke execute on function public.claim_study_goal_reminders() from public, anon, authenticated;
grant execute on function public.claim_study_goal_reminders() to service_role;

commit;
