begin;

create extension if not exists pgcrypto;

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
update public.profiles set handle = regexp_replace(handle, '^@+', ''), nickname = regexp_replace(nickname, '^@+', '') where handle like '@%';
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

create table if not exists public.study_comments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

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

create or replace function public.send_friend_request(target_handle text)
returns public.friend_requests language plpgsql security definer set search_path = public as $$
declare target_id uuid; result public.friend_requests;
begin
  select id into target_id from profiles where handle = regexp_replace(lower(trim(target_handle)), '^@+', '');
  if target_id is null then raise exception '해당 핸들의 사용자를 찾을 수 없습니다.'; end if;
  if target_id = auth.uid() then raise exception '자기 자신에게 요청할 수 없습니다.'; end if;
  if exists(select 1 from friendships where user_id = auth.uid() and friend_id = target_id) then raise exception '이미 친구입니다.'; end if;
  insert into friend_requests(sender_id, receiver_id) values(auth.uid(), target_id) returning * into result;
  return result;
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare req friend_requests;
begin
  select * into req from friend_requests where id = request_id and receiver_id = auth.uid() and status = 'pending' for update;
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
  select * into target_room from study_rooms where id = target_study;
  if target_room.id is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;
  if target_room.is_private and not public.has_study_room_access(target_study) then raise exception '비밀번호 확인이 필요합니다.'; end if;
  insert into study_members(study_id, user_id, role) values(target_study, auth.uid(), 'member') on conflict do nothing;
end;
$$;

create or replace function public.delete_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from study_rooms where id = target_study and owner_id = auth.uid()) then raise exception '방장만 스터디룸을 삭제할 수 있습니다.'; end if;
  delete from study_rooms where id = target_study and owner_id = auth.uid();
end;
$$;

create or replace function public.leave_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists(select 1 from study_rooms where id = target_study and owner_id = auth.uid()) then raise exception '방장은 방을 나갈 수 없습니다. 스터디룸을 삭제해주세요.'; end if;
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
create or replace function public.create_study_room(room_name text, room_description text, room_goal_count integer, room_password text default null, room_goal_period text default 'weekly')
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
  return room_id;
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
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.study_rooms enable row level security;
alter table public.study_members enable row level security;
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

commit;
