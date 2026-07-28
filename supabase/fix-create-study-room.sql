begin;

alter table public.study_rooms
  add column if not exists goal_period text not null default 'weekly'
  check (goal_period in ('daily', 'weekly'));

alter table public.study_rooms
  add column if not exists goal_count integer not null default 7
  check (goal_count between 1 and 100);

drop function if exists public.create_study_room(text, text, integer, text);
drop function if exists public.create_study_room(text, text, integer, text, text);

create function public.create_study_room(
  room_name text,
  room_description text,
  room_goal_count integer,
  room_password text default null,
  room_goal_period text default 'weekly'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
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

revoke execute on function public.create_study_room(text, text, integer, text, text) from public, anon;
grant execute on function public.create_study_room(text, text, integer, text, text) to authenticated;

commit;
