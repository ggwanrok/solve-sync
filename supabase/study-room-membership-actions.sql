begin;

create or replace function public.delete_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists(select 1 from study_rooms where id = target_study and owner_id = auth.uid()) then raise exception '방장만 스터디룸을 삭제할 수 있습니다.'; end if;
  delete from study_rooms where id = target_study and owner_id = auth.uid();
end;
$$;

create or replace function public.leave_study_room(target_study uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if exists(select 1 from study_rooms where id = target_study and owner_id = auth.uid()) then raise exception '방장은 방을 나갈 수 없습니다. 스터디룸을 삭제해주세요.'; end if;
  if not exists(select 1 from study_members where study_id = target_study and user_id = auth.uid()) then raise exception '참여 중인 스터디룸이 아닙니다.'; end if;
  delete from study_members where study_id = target_study and user_id = auth.uid();
end;
$$;

revoke execute on function public.delete_study_room(uuid) from public, anon;
revoke execute on function public.leave_study_room(uuid) from public, anon;
grant execute on function public.delete_study_room(uuid) to authenticated;
grant execute on function public.leave_study_room(uuid) to authenticated;

commit;
