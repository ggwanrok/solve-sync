create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_user uuid := auth.uid();
begin
  if target_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  -- 앱 데이터를 먼저 정리해 auth.users 삭제 시 거대한 연쇄 삭제가 다시 일어나지 않게 한다.
  delete from public.profiles where id = target_user;
  delete from auth.users where id = target_user;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
