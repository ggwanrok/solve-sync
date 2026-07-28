begin;

create table if not exists public.study_room_access (
  study_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  verified_at timestamptz not null default now(),
  primary key (study_id, user_id)
);

alter table public.study_room_access enable row level security;

create or replace function public.has_study_room_access(target_study uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from study_room_access where study_id = target_study and user_id = auth.uid() and verified_at > now() - interval '1 hour');
$$;

create or replace function public.verify_study_room_password(target_study uuid, provided_password text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare stored_hash text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
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
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select * into target_room from study_rooms where id = target_study;
  if target_room.id is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;
  if target_room.is_private and not public.has_study_room_access(target_study) then raise exception '비밀번호 확인이 필요합니다.'; end if;
  insert into study_members(study_id, user_id, role) values(target_study, auth.uid(), 'member') on conflict do nothing;
end;
$$;

revoke execute on function public.has_study_room_access(uuid) from public, anon;
revoke execute on function public.verify_study_room_password(uuid, text) from public, anon;
revoke execute on function public.join_study_room(uuid) from public, anon;
grant execute on function public.has_study_room_access(uuid) to authenticated;
grant execute on function public.verify_study_room_password(uuid, text) to authenticated;
grant execute on function public.join_study_room(uuid) to authenticated;

commit;
