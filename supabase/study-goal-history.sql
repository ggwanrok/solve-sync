begin;

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

create index if not exists solve_events_user_accepted_at
  on public.solve_events(user_id, accepted_at);

alter table public.study_membership_history enable row level security;
revoke all on public.study_membership_history from anon, authenticated;

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

create or replace function public.join_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_room study_rooms;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  select * into target_room from study_rooms where id = target_study;
  if target_room.id is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;
  if target_room.is_private and not public.has_study_room_access(target_study) then raise exception '비밀번호 확인이 필요합니다.'; end if;

  insert into study_members(study_id, user_id, role)
  values(target_study, auth.uid(), 'member')
  on conflict do nothing;

  insert into study_membership_history(study_id, user_id, role)
  values(target_study, auth.uid(), 'member')
  on conflict (study_id, user_id) where left_at is null do nothing;
end;
$$;

create or replace function public.leave_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if exists(select 1 from study_rooms where id = target_study and owner_id = auth.uid()) then raise exception '방장은 방을 나갈 수 없습니다. 스터디룸을 삭제해주세요.'; end if;
  if not exists(select 1 from study_members where study_id = target_study and user_id = auth.uid()) then raise exception '참여 중인 스터디룸이 아닙니다.'; end if;

  update study_membership_history
  set left_at = now()
  where study_id = target_study and user_id = auth.uid() and left_at is null;

  delete from study_members where study_id = target_study and user_id = auth.uid();
end;
$$;

create or replace function public.create_study_room(
  room_name text,
  room_description text,
  room_goal_count integer,
  room_password text default null,
  room_goal_period text default 'weekly'
)
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

revoke execute on function public.study_goal_history(uuid) from public, anon;
grant execute on function public.study_goal_history(uuid) to authenticated;

commit;
