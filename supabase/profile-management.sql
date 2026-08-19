begin;

create or replace function public.remove_friend(target_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  removed_rows integer;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if target_user is null or target_user = current_user_id then
    raise exception '삭제할 친구 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;

  delete from public.friendships
  where (user_id = current_user_id and friend_id = target_user)
     or (user_id = target_user and friend_id = current_user_id);
  get diagnostics removed_rows = row_count;
  return removed_rows > 0;
end;
$$;

revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read_own on storage.objects;
create policy avatars_read_own on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
