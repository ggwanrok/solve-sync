begin;

create or replace function public.study_room_notification_settings(target_study uuid)
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

  select room.id, room.name
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

revoke execute on function public.study_room_notification_settings(uuid) from public, anon;
grant execute on function public.study_room_notification_settings(uuid) to authenticated;
revoke execute on function public.create_study_poke(uuid, uuid) from public, anon;
grant execute on function public.create_study_poke(uuid, uuid) to authenticated;

commit;
