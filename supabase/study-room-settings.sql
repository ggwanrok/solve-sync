begin;

create or replace function public.update_study_room(
  target_study uuid,
  room_name text,
  room_description text,
  room_is_private boolean,
  room_password text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_room public.study_rooms%rowtype;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if room_name is null or char_length(trim(room_name)) not between 1 and 30 then
    raise exception '스터디룸 이름은 1~30자로 입력해 주세요.' using errcode = '22023';
  end if;
  if char_length(coalesce(room_description, '')) > 100 then
    raise exception '소개는 100자 이하로 입력해 주세요.' using errcode = '22023';
  end if;
  if room_is_private is null then
    raise exception '공개 설정을 확인해 주세요.' using errcode = '22023';
  end if;

  select * into target_room
  from public.study_rooms
  where id = target_study and owner_id = current_user_id
  for update;

  if target_room.id is null then
    raise exception '방장만 스터디룸 설정을 변경할 수 있습니다.' using errcode = '42501';
  end if;
  if not target_room.is_private and room_is_private
    and (room_password is null or char_length(room_password) not between 8 and 50) then
    raise exception '비공개방 비밀번호는 8~50자로 입력해 주세요.' using errcode = '22023';
  end if;

  update public.study_rooms
  set
    name = trim(room_name),
    description = trim(coalesce(room_description, '')),
    is_private = room_is_private,
    password_hash = case
      when not room_is_private then null
      when not target_room.is_private then extensions.crypt(room_password, extensions.gen_salt('bf'))
      else target_room.password_hash
    end
  where id = target_study and owner_id = current_user_id;

  if target_room.is_private <> room_is_private then
    delete from public.study_room_access where study_id = target_study;
  end if;
end;
$$;

revoke execute on function public.update_study_room(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.update_study_room(uuid, text, text, boolean, text) to authenticated;

commit;
