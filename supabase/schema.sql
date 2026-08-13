begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  nickname text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profiles add column if not exists guide_completed_at timestamptz;

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friend_request check (sender_id <> receiver_id)
);
create unique index if not exists friend_requests_pending_unique
  on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status = 'pending';

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint no_self_friendship check (user_id <> friend_id)
);

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  description text not null default '' check (char_length(description) <= 100),
  emoji text not null default '🚀',
  weekly_goal integer not null default 7 check (weekly_goal between 1 and 100),
  max_members integer not null default 8 check (max_members between 2 and 50),
  is_private boolean not null default false,
  password_hash text,
  created_at timestamptz not null default now()
);
create index if not exists study_rooms_created_at_desc
  on public.study_rooms(created_at desc, id desc);

alter table public.study_rooms add column if not exists is_private boolean not null default false;
alter table public.study_rooms add column if not exists password_hash text;
alter table public.study_rooms add column if not exists goal_period text not null default 'weekly' check (goal_period in ('daily', 'weekly'));
alter table public.study_rooms add column if not exists goal_count integer not null default 7 check (goal_count between 1 and 100);

create table if not exists public.study_members (
  study_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader','member')),
  joined_at timestamptz not null default now(),
  primary key (study_id, user_id)
);

create table if not exists public.study_membership_history (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  check (left_at is null or left_at >= joined_at)
);
create unique index if not exists study_membership_history_active_unique
  on public.study_membership_history(study_id, user_id)
  where left_at is null;
create index if not exists study_membership_history_period_lookup
  on public.study_membership_history(study_id, joined_at, left_at);

insert into public.study_membership_history(study_id, user_id, role, joined_at)
select sm.study_id, sm.user_id, sm.role, sm.joined_at
from public.study_members sm
where not exists (
  select 1
  from public.study_membership_history history
  where history.study_id = sm.study_id
    and history.user_id = sm.user_id
    and history.left_at is null
);

create table if not exists public.study_comments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists study_comments_study_created_at
  on public.study_comments(study_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'study_comments'
  ) then
    alter publication supabase_realtime add table public.study_comments;
  end if;
end;
$$;

create table if not exists public.study_room_access (
  study_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  verified_at timestamptz not null default now(),
  primary key (study_id, user_id)
);

create table if not exists public.extension_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.solve_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'programmers',
  problem_id text not null,
  title text not null default '',
  url text not null,
  language text,
  started_at timestamptz,
  duration_seconds integer,
  accepted_at timestamptz not null,
  received_at timestamptz not null default now(),
  source text not null default 'chrome-extension',
  unique(user_id, platform, problem_id)
);
create index if not exists solve_events_user_accepted_at
  on public.solve_events(user_id, accepted_at);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.claim_handle(desired_handle text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  normalized text := regexp_replace(lower(trim(desired_handle)), '^@+', '');
  result public.profiles;
begin
  if normalized !~ '^[a-z0-9_]{3,20}$' then
    raise exception '닉네임은 영문 소문자, 숫자, 밑줄 3~20자로 입력해 주세요.' using errcode = '22023';
  end if;
  insert into profiles (id, nickname)
  values (auth.uid(), '')
  on conflict (id) do nothing;
  update profiles set handle = normalized, nickname = normalized, updated_at = now()
  where id = auth.uid() and handle is null returning * into result;
  if result.id is null then
    select * into result from profiles where id = auth.uid();
  end if;
  return result;
exception when unique_violation then
  raise exception '이미 사용 중인 핸들입니다.' using errcode = '23505';
end;
$$;

create or replace function public.is_handle_available(desired_handle text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare normalized text := regexp_replace(lower(trim(desired_handle)), '^@+', '');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if normalized !~ '^[a-z0-9_]{3,20}$' then
    return false;
  end if;
  return not exists(select 1 from profiles where handle = normalized);
end;
$$;

drop function if exists public.send_friend_request(text);
create function public.send_friend_request(target_handle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  target_id uuid;
  pending_request public.friend_requests;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  select id into target_id from profiles where handle = regexp_replace(lower(trim(target_handle)), '^@+', '');
  if target_id is null then return jsonb_build_object('status', 'not_found'); end if;
  if target_id = current_user_id then return jsonb_build_object('status', 'self'); end if;

  -- 같은 두 사용자의 요청/수락을 직렬화해 교차 요청과 수락 경합도 한 상태로 처리한다.
  perform pg_advisory_xact_lock(hashtextextended(
    least(current_user_id::text, target_id::text) || ':' || greatest(current_user_id::text, target_id::text),
    0
  ));

  if exists(select 1 from friendships where user_id = current_user_id and friend_id = target_id) then
    return jsonb_build_object('status', 'already_friends');
  end if;

  select * into pending_request
  from friend_requests
  where status = 'pending'
    and least(sender_id, receiver_id) = least(current_user_id, target_id)
    and greatest(sender_id, receiver_id) = greatest(current_user_id, target_id)
  for update;

  if pending_request.id is not null then
    return jsonb_build_object(
      'status', case when pending_request.sender_id = current_user_id then 'already_sent' else 'incoming_pending' end,
      'request_id', pending_request.id
    );
  end if;

  insert into friend_requests(sender_id, receiver_id)
  values(current_user_id, target_id)
  returning * into pending_request;

  return jsonb_build_object('status', 'sent', 'request_id', pending_request.id);
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  req friend_requests;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;

  select * into req from friend_requests where id = request_id and receiver_id = current_user_id and status = 'pending';
  if req.id is null then raise exception '처리할 수 없는 친구 요청입니다.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(req.sender_id::text, req.receiver_id::text) || ':' || greatest(req.sender_id::text, req.receiver_id::text),
    0
  ));

  select * into req from friend_requests where id = request_id and receiver_id = current_user_id and status = 'pending' for update;
  if req.id is null then raise exception '처리할 수 없는 친구 요청입니다.'; end if;
  update friend_requests set status = case when accept then 'accepted' else 'declined' end, responded_at = now() where id = req.id;
  if accept then
    insert into friendships(user_id, friend_id) values(req.sender_id, req.receiver_id),(req.receiver_id, req.sender_id) on conflict do nothing;
  end if;
end;
$$;

create or replace function public.is_study_member(target_study uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from study_members where study_id = target_study and user_id = auth.uid());
$$;

create or replace function public.study_room_directory(
  directory_field text default 'title',
  directory_query text default '',
  page_number integer default 1,
  page_size integer default 12
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  normalized_field text := case when directory_field in ('title', 'description', 'owner') then directory_field else 'title' end;
  normalized_query text := trim(coalesce(directory_query, ''));
  search_pattern text;
  safe_page integer := greatest(1, coalesce(page_number, 1));
  safe_page_size integer := greatest(1, least(coalesce(page_size, 12), 50));
  result jsonb;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;

  search_pattern := '%' || replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  with matching_rooms as (
    select
      room.id,
      room.owner_id,
      room.name,
      room.description,
      room.goal_period,
      room.goal_count,
      room.is_private,
      room.created_at,
      owner.handle as owner_handle,
      owner.nickname as owner_nickname
    from study_rooms room
    join profiles owner on owner.id = room.owner_id
    where normalized_query = '' or case normalized_field
      when 'description' then room.description
      when 'owner' then concat_ws(' ', owner.nickname, owner.handle)
      else room.name
    end ilike search_pattern escape E'\\'
  ),
  paged_rooms as (
    select *
    from matching_rooms
    order by created_at desc, id desc
    limit safe_page_size
    offset (safe_page - 1) * safe_page_size
  ),
  directory_rows as (
    select
      room.*,
      coalesce(member_stats.member_count, 0) as member_count,
      coalesce(member_stats.is_joined, false) as is_joined
    from paged_rooms room
    left join lateral (
      select
        count(*)::bigint as member_count,
        coalesce(bool_or(member.user_id = current_user_id), false) as is_joined
      from study_members member
      where member.study_id = room.id
    ) member_stats on true
  )
  select jsonb_build_object(
    'rooms', coalesce((select jsonb_agg(to_jsonb(directory_rows) order by created_at desc, id desc) from directory_rows), '[]'::jsonb),
    'total', (select count(*) from matching_rooms),
    'page', safe_page,
    'pageSize', safe_page_size
  ) into result;

  return result;
end;
$$;

create or replace function public.has_study_room_access(target_study uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from study_room_access
    where study_id = target_study and user_id = auth.uid() and verified_at > now() - interval '1 hour'
  );
$$;

create or replace function public.verify_study_room_password(target_study uuid, provided_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare stored_hash text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  select password_hash into stored_hash from study_rooms where id = target_study and is_private;
  if stored_hash is null or extensions.crypt(provided_password, stored_hash) <> stored_hash then return false; end if;
  insert into study_room_access(study_id, user_id, verified_at) values(target_study, auth.uid(), now())
  on conflict(study_id, user_id) do update set verified_at = excluded.verified_at;
  return true;
end;
$$;

create or replace function public.join_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_room study_rooms;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  select * into target_room from study_rooms where id = target_study;
  if target_room.id is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;
  if target_room.is_private and not public.has_study_room_access(target_study) then raise exception '비밀번호 확인이 필요합니다.'; end if;
  insert into study_members(study_id, user_id, role) values(target_study, auth.uid(), 'member') on conflict do nothing;
  insert into study_membership_history(study_id, user_id, role) values(target_study, auth.uid(), 'member')
  on conflict (study_id, user_id) where left_at is null do nothing;
end;
$$;

create or replace function public.delete_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if not exists(select 1 from study_rooms where id = target_study and owner_id = auth.uid()) then raise exception '방장만 스터디룸을 삭제할 수 있습니다.'; end if;
  delete from study_rooms where id = target_study and owner_id = auth.uid();
end;
$$;

create or replace function public.leave_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if exists(select 1 from study_rooms where id = target_study and owner_id = auth.uid()) then raise exception '방장은 방을 나갈 수 없습니다. 스터디룸을 삭제해주세요.'; end if;
  if not exists(select 1 from study_members where study_id = target_study and user_id = auth.uid()) then raise exception '참여 중인 스터디룸이 아닙니다.'; end if;
  update study_membership_history set left_at = now()
  where study_id = target_study and user_id = auth.uid() and left_at is null;
  delete from study_members where study_id = target_study and user_id = auth.uid();
end;
$$;

create or replace function public.study_member_goal_progress(target_study uuid)
returns table(user_id uuid, solved_count bigint)
language plpgsql security definer set search_path = public as $$
declare target_period text;
begin
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

drop function if exists public.create_study_room(text, text, integer, text);
drop function if exists public.create_study_room(text, text, integer, text, text);
create function public.create_study_room(room_name text, room_description text, room_goal_count integer, room_password text default null, room_goal_period text default 'weekly')
returns uuid language plpgsql security definer set search_path = public as $$
declare room_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if char_length(trim(room_name)) not between 1 and 30 then raise exception '스터디룸 이름은 1~30자로 입력해 주세요.'; end if;
  if char_length(coalesce(room_description, '')) > 100 then raise exception '소개는 100자 이하로 입력해 주세요.'; end if;
  if room_goal_period not in ('daily', 'weekly') then raise exception '목표 주기를 확인해 주세요.'; end if;
  if room_goal_count not between 1 and 100 then raise exception '목표 문제 수를 확인해 주세요.'; end if;
  if room_password is not null and char_length(room_password) < 8 then raise exception '비밀번호는 8자 이상 입력해 주세요.'; end if;
  insert into study_rooms(owner_id, name, description, weekly_goal, goal_period, goal_count, max_members, is_private, password_hash)
  values(auth.uid(), trim(room_name), trim(coalesce(room_description, '')), case when room_goal_period = 'daily' then room_goal_count * 7 else room_goal_count end, room_goal_period, room_goal_count, 50, room_password is not null, case when room_password is null then null else extensions.crypt(room_password, extensions.gen_salt('bf')) end)
  returning id into room_id;
  insert into study_members(study_id, user_id, role) values(room_id, auth.uid(), 'leader');
  insert into study_membership_history(study_id, user_id, role) values(room_id, auth.uid(), 'leader');
  return room_id;
end;
$$;

create or replace function public.study_goal_history(target_study uuid)
returns table(
  period_start timestamptz,
  period_end timestamptz,
  period_number bigint,
  user_id uuid,
  role text,
  handle text,
  nickname text,
  avatar_url text,
  solved_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if not public.is_study_member(target_study) then raise exception '스터디 멤버만 지난 기록을 볼 수 있습니다.'; end if;

  return query
  with target_room as (
    select sr.created_at, sr.goal_period
    from study_rooms sr
    where sr.id = target_study
  ),
  periods as (
    select
      generated.period_local at time zone 'Asia/Seoul' as period_start,
      (generated.period_local + case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul' as period_end,
      row_number() over (order by generated.period_local) as period_number
    from target_room room
    cross join lateral generate_series(
      date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, room.created_at at time zone 'Asia/Seoul'),
      date_trunc(case when room.goal_period = 'daily' then 'day' else 'week' end, now() at time zone 'Asia/Seoul')
        - case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end,
      case when room.goal_period = 'daily' then interval '1 day' else interval '1 week' end
    ) as generated(period_local)
  )
  select
    periods.period_start,
    periods.period_end,
    periods.period_number,
    history.user_id,
    history.role,
    profile.handle,
    profile.nickname,
    profile.avatar_url,
    count(distinct event.problem_id)::bigint as solved_count
  from periods
  join study_membership_history history
    on history.study_id = target_study
    and history.joined_at < periods.period_end
    and coalesce(history.left_at, 'infinity'::timestamptz) > periods.period_start
  join profiles profile on profile.id = history.user_id
  left join solve_events event
    on event.user_id = history.user_id
    and event.accepted_at >= periods.period_start
    and event.accepted_at < periods.period_end
  group by periods.period_start, periods.period_end, periods.period_number,
    history.user_id, history.role, profile.handle, profile.nickname, profile.avatar_url
  order by periods.period_start desc, profile.nickname, profile.handle;
end;
$$;

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

create or replace function public.study_room_detail(target_study uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  target_room study_rooms;
  is_member boolean;
  can_view boolean;
  period_unit text;
  period_step interval;
  current_period_local timestamp;
  current_period_start timestamptz;
  current_period_end timestamptz;
  members_json jsonb := '[]'::jsonb;
  progress_json jsonb := '[]'::jsonb;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  select * into target_room from study_rooms where id = target_study;
  if target_room.id is null then return jsonb_build_object('room', null); end if;
  select exists(select 1 from study_members member where member.study_id = target_study and member.user_id = current_user_id) into is_member;
  can_view := not target_room.is_private or is_member or exists(select 1 from study_room_access access where access.study_id = target_study and access.user_id = current_user_id);
  if not can_view then
    return jsonb_build_object('room', jsonb_build_object('id', target_room.id, 'name', target_room.name, 'isPrivate', true), 'members', '[]'::jsonb, 'progress', '[]'::jsonb, 'isMember', false, 'canView', false, 'currentPeriod', null);
  end if;
  period_unit := case when target_room.goal_period = 'daily' then 'day' else 'week' end;
  period_step := case when target_room.goal_period = 'daily' then interval '1 day' else interval '1 week' end;
  current_period_local := date_trunc(period_unit, now() at time zone 'Asia/Seoul');
  current_period_start := current_period_local at time zone 'Asia/Seoul';
  current_period_end := (current_period_local + period_step) at time zone 'Asia/Seoul';
  select coalesce(jsonb_agg(jsonb_build_object('userId', member.user_id, 'role', member.role, 'joinedAt', member.joined_at, 'profile', jsonb_build_object('handle', profile.handle, 'nickname', profile.nickname, 'avatar_url', profile.avatar_url)) order by member.joined_at, member.user_id), '[]'::jsonb)
  into members_json from study_members member join profiles profile on profile.id = member.user_id where member.study_id = target_study;
  if is_member then
    select coalesce(jsonb_agg(jsonb_build_object('userId', progress.user_id, 'solvedCount', progress.solved_count) order by progress.user_id), '[]'::jsonb)
    into progress_json from (
      select member.user_id, count(distinct event.problem_id)::bigint as solved_count
      from study_members member
      left join solve_events event on event.user_id = member.user_id and event.accepted_at >= current_period_start and event.accepted_at < current_period_end
      where member.study_id = target_study group by member.user_id
    ) progress;
  end if;
  return jsonb_build_object(
    'room', jsonb_build_object('id', target_room.id, 'ownerId', target_room.owner_id, 'name', target_room.name, 'description', target_room.description, 'goalPeriod', target_room.goal_period, 'goalCount', target_room.goal_count, 'isPrivate', target_room.is_private),
    'members', members_json, 'progress', progress_json, 'isMember', is_member, 'canView', true,
    'currentPeriod', jsonb_build_object('start', current_period_start, 'end', current_period_end)
  );
end;
$$;

create or replace function public.study_goal_history_page(target_study uuid, page_number integer default 1, page_size integer default 5, history_order text default 'newest')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  target_room record;
  period_unit text;
  period_step interval;
  first_period_local timestamp;
  current_period_local timestamp;
  total_periods integer;
  safe_page integer := greatest(1, coalesce(page_number, 1));
  safe_page_size integer := greatest(1, least(coalesce(page_size, 5), 10));
  safe_order text := case when history_order = 'oldest' then 'oldest' else 'newest' end;
  start_position integer;
  result jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if not public.is_study_member(target_study) then raise exception '스터디 멤버만 지난 기록을 볼 수 있습니다.'; end if;
  select room.created_at, room.goal_period into target_room from study_rooms room where room.id = target_study;
  if target_room.created_at is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;
  period_unit := case when target_room.goal_period = 'daily' then 'day' else 'week' end;
  period_step := case when target_room.goal_period = 'daily' then interval '1 day' else interval '1 week' end;
  first_period_local := date_trunc(period_unit, target_room.created_at at time zone 'Asia/Seoul');
  current_period_local := date_trunc(period_unit, now() at time zone 'Asia/Seoul');
  total_periods := greatest(0, floor(extract(epoch from (current_period_local - first_period_local)) / extract(epoch from period_step))::integer);
  start_position := (safe_page - 1) * safe_page_size;
  with page_positions as (
    select position from generate_series(start_position, least(total_periods - 1, start_position + safe_page_size - 1)) position
  ), periods as (
    select case when safe_order = 'oldest' then total_periods - position else position + 1 end as period_offset from page_positions
  ), period_bounds as (
    select (current_period_local - period_step * period_offset) at time zone 'Asia/Seoul' as period_start,
      (current_period_local - period_step * period_offset + period_step) at time zone 'Asia/Seoul' as period_end,
      total_periods - period_offset + 1 as period_number from periods
  ), history_rows as (
    select period.period_start, period.period_end, period.period_number, history.user_id, history.role,
      profile.handle, profile.nickname, profile.avatar_url, count(distinct event.problem_id)::bigint as solved_count
    from period_bounds period
    join study_membership_history history on history.study_id = target_study and history.joined_at < period.period_end and coalesce(history.left_at, 'infinity'::timestamptz) > period.period_start
    join profiles profile on profile.id = history.user_id
    left join solve_events event on event.user_id = history.user_id and event.accepted_at >= period.period_start and event.accepted_at < period.period_end
    group by period.period_start, period.period_end, period.period_number, history.user_id, history.role, profile.handle, profile.nickname, profile.avatar_url
  )
  select jsonb_build_object(
    'entries', coalesce(jsonb_agg(to_jsonb(history_rows) order by case when safe_order = 'newest' then period_number end desc, case when safe_order = 'oldest' then period_number end asc, nickname, handle), '[]'::jsonb),
    'page', safe_page, 'pageSize', safe_page_size, 'totalPeriods', total_periods,
    'totalPages', case when total_periods = 0 then 0 else ceil(total_periods::numeric / safe_page_size)::integer end
  ) into result from history_rows;
  return result;
end;
$$;

create or replace function public.study_member_period_solve_events(target_study uuid, target_user uuid, target_period_start timestamptz)
returns table(problem_id text, title text, url text, language text, accepted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  target_period text;
  period_start timestamptz;
  period_end timestamptz;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if not public.is_study_member(target_study) then raise exception '스터디 멤버만 풀이 상세를 볼 수 있습니다.'; end if;
  select room.goal_period into target_period from study_rooms room where room.id = target_study;
  if target_period is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;
  period_start := date_trunc(case when target_period = 'daily' then 'day' else 'week' end, target_period_start at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  period_end := (period_start at time zone 'Asia/Seoul' + case when target_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul';
  if not exists(select 1 from study_membership_history history where history.study_id = target_study and history.user_id = target_user and history.joined_at < period_end and coalesce(history.left_at, 'infinity'::timestamptz) > period_start) then return; end if;
  return query select event.problem_id, event.title, event.url, event.language, event.accepted_at
  from solve_events event where event.user_id = target_user and event.accepted_at >= period_start and event.accepted_at < period_end
  order by event.accepted_at desc;
end;
$$;

create or replace function public.record_programmers_event(
  auth_token_hash text,
  event_problem_id text,
  event_title text,
  event_url text,
  event_language text,
  event_started_at timestamptz,
  event_duration_seconds integer,
  event_accepted_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target_user uuid; inserted_id uuid;
begin
  select user_id into target_user from extension_connections where token_hash = auth_token_hash;
  if target_user is null then raise exception '유효하지 않은 익스텐션 토큰입니다.' using errcode = '28000'; end if;
  update extension_connections set last_seen_at = now() where user_id = target_user;
  insert into solve_events(user_id, problem_id, title, url, language, started_at, duration_seconds, accepted_at)
  values(target_user, event_problem_id, left(event_title, 200), event_url, event_language, event_started_at, event_duration_seconds, event_accepted_at)
  on conflict(user_id, platform, problem_id) do nothing returning id into inserted_id;
  return jsonb_build_object('id', inserted_id, 'duplicate', inserted_id is null);
end;
$$;

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid := auth.uid();
begin
  if target_user is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  delete from public.profiles where id = target_user;
  delete from auth.users where id = target_user;
end;
$$;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.study_rooms enable row level security;
alter table public.study_members enable row level security;
alter table public.study_membership_history enable row level security;
alter table public.study_comments enable row level security;
alter table public.study_room_access enable row level security;
alter table public.extension_connections enable row level security;
alter table public.solve_events enable row level security;

drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists friend_requests_read_participant on public.friend_requests;
create policy friend_requests_read_participant on public.friend_requests for select to authenticated using ((select auth.uid()) in (sender_id, receiver_id));
drop policy if exists friendships_read_self on public.friendships;
create policy friendships_read_self on public.friendships for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists study_rooms_read_members on public.study_rooms;
drop policy if exists study_rooms_read_authenticated on public.study_rooms;
create policy study_rooms_read_authenticated on public.study_rooms for select to authenticated using (true);
drop policy if exists study_rooms_create on public.study_rooms;
drop policy if exists study_rooms_update_owner on public.study_rooms;

drop policy if exists study_members_read_members on public.study_members;
drop policy if exists study_members_read_authenticated on public.study_members;
create policy study_members_read_authenticated on public.study_members for select to authenticated using (true);
drop policy if exists study_members_join_self on public.study_members;

drop policy if exists study_comments_read_members on public.study_comments;
create policy study_comments_read_members on public.study_comments for select to authenticated using (public.is_study_member(study_id));
drop policy if exists study_comments_create_members on public.study_comments;
create policy study_comments_create_members on public.study_comments for insert to authenticated with check (author_id = (select auth.uid()) and public.is_study_member(study_id));

drop policy if exists extension_connections_self on public.extension_connections;
create policy extension_connections_self on public.extension_connections for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists solve_events_read_self on public.solve_events;
create policy solve_events_read_self on public.solve_events for select to authenticated using (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(nickname, avatar_url, guide_completed_at) on public.profiles to authenticated;
grant select on public.friend_requests, public.friendships to authenticated;
revoke all on public.study_rooms from authenticated;
grant select(id, owner_id, name, description, emoji, weekly_goal, max_members, is_private, created_at, goal_period, goal_count) on public.study_rooms to authenticated;
revoke all on public.study_members from authenticated;
grant select on public.study_members to authenticated;
revoke all on public.study_membership_history from anon, authenticated;
grant select, insert on public.study_comments to authenticated;
grant select, insert, update, delete on public.extension_connections to authenticated;
grant select on public.solve_events to authenticated;
revoke execute on function public.claim_handle(text), public.is_handle_available(text), public.send_friend_request(text), public.respond_friend_request(uuid, boolean), public.is_study_member(uuid), public.create_study_room(text, text, integer, text, text) from public, anon;
grant execute on function public.claim_handle(text), public.is_handle_available(text), public.send_friend_request(text), public.respond_friend_request(uuid, boolean), public.is_study_member(uuid), public.create_study_room(text, text, integer, text, text) to authenticated;
grant usage on schema public to anon;
revoke execute on function public.record_programmers_event(text, text, text, text, text, timestamptz, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
revoke execute on function public.has_study_room_access(uuid), public.verify_study_room_password(uuid, text), public.join_study_room(uuid) from public, anon;
grant execute on function public.has_study_room_access(uuid), public.verify_study_room_password(uuid, text), public.join_study_room(uuid) to authenticated;
revoke execute on function public.delete_study_room(uuid), public.leave_study_room(uuid) from public, anon;
grant execute on function public.delete_study_room(uuid), public.leave_study_room(uuid) to authenticated;
revoke execute on function public.study_member_goal_progress(uuid) from public, anon;
grant execute on function public.study_member_goal_progress(uuid) to authenticated;
revoke execute on function public.study_goal_history(uuid) from public, anon;
grant execute on function public.study_goal_history(uuid) to authenticated;
revoke execute on function public.study_member_solve_events(uuid) from public, anon;
grant execute on function public.study_member_solve_events(uuid) to authenticated;
revoke execute on function public.study_room_directory(text, text, integer, integer) from public, anon;
grant execute on function public.study_room_directory(text, text, integer, integer) to authenticated;
revoke execute on function public.study_room_detail(uuid) from public, anon;
grant execute on function public.study_room_detail(uuid) to authenticated;
revoke execute on function public.study_goal_history_page(uuid, integer, integer, text) from public, anon;
grant execute on function public.study_goal_history_page(uuid, integer, integer, text) to authenticated;
revoke execute on function public.study_member_period_solve_events(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.study_member_period_solve_events(uuid, uuid, timestamptz) to authenticated;

commit;
