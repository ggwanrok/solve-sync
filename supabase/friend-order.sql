begin;

-- Each direction of a friendship has its own order. New friends stay at the end.
alter table public.friendships add column if not exists sort_order integer check (sort_order >= 0);

create or replace function public.reorder_friends(ordered_friend_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if ordered_friend_ids is null
    or coalesce(array_ndims(ordered_friend_ids), 1) <> 1
    or array_position(ordered_friend_ids, null) is not null
    or cardinality(ordered_friend_ids) <> (select count(distinct id) from unnest(ordered_friend_ids) as ids(id)) then
    raise exception '친구 순서 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;

  -- Serialize saves and removals while changing only the caller's rows.
  perform 1 from public.friendships
  where user_id = current_user_id
  order by friend_id
  for update;

  if exists (
    select 1 from unnest(ordered_friend_ids) as ids(id)
    where not exists (
      select 1 from public.friendships
      where user_id = current_user_id and friend_id = ids.id
    )
  ) or exists (
    select 1 from public.friendships
    where user_id = current_user_id and not (friend_id = any(ordered_friend_ids))
  ) then
    return false;
  end if;

  update public.friendships as friendship
  set sort_order = ordered.position::integer
  from unnest(ordered_friend_ids) with ordinality as ordered(friend_id, position)
  where friendship.user_id = current_user_id and friendship.friend_id = ordered.friend_id;

  return true;
end;
$$;

revoke execute on function public.reorder_friends(uuid[]) from public, anon;
grant execute on function public.reorder_friends(uuid[]) to authenticated;

commit;
