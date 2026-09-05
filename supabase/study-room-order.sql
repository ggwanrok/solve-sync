begin;

-- A membership's order belongs to that user. New memberships have no order and
-- are placed after the user's saved items until the next save.
alter table public.study_members
  add column if not exists sort_order integer check (sort_order >= 0);

create index if not exists study_members_user_order
  on public.study_members(user_id, sort_order, joined_at, study_id);

create or replace function public.reorder_joined_studies(ordered_study_ids uuid[])
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
  if ordered_study_ids is null
    or coalesce(array_ndims(ordered_study_ids), 1) <> 1
    or array_position(ordered_study_ids, null) is not null
    or cardinality(ordered_study_ids) <> (select count(distinct id) from unnest(ordered_study_ids) as ids(id)) then
    raise exception '스터디룸 배치 정보가 올바르지 않습니다.' using errcode = '22023';
  end if;

  perform 1 from public.study_members
  where user_id = current_user_id
  order by study_id
  for update;

  if exists (
    select 1 from unnest(ordered_study_ids) as ids(id)
    where not exists (
      select 1 from public.study_members
      where user_id = current_user_id and study_id = ids.id
    )
  ) or exists (
    select 1 from public.study_members
    where user_id = current_user_id and not (study_id = any(ordered_study_ids))
  ) then
    return false;
  end if;

  update public.study_members as membership
  set sort_order = ordered.position::integer
  from unnest(ordered_study_ids) with ordinality as ordered(study_id, position)
  where membership.user_id = current_user_id and membership.study_id = ordered.study_id;

  return true;
end;
$$;

create or replace function public.study_room_directory(
  directory_field text default 'title',
  directory_query text default '',
  page_number integer default 1,
  page_size integer default 12,
  difficulty_levels integer[] default array[0, 1, 2, 3, 4, 5],
  joined_only boolean default false
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
      room.min_difficulty,
      room.is_private,
      room.created_at,
      owner.handle as owner_handle,
      owner.nickname as owner_nickname,
      current_member.sort_order as joined_sort_order,
      current_member.joined_at as joined_at
    from study_rooms room
    join profiles owner on owner.id = room.owner_id
    left join study_members current_member
      on current_member.study_id = room.id and current_member.user_id = current_user_id
    where room.min_difficulty = any(coalesce(difficulty_levels, array[0, 1, 2, 3, 4, 5]))
      and (not coalesce(joined_only, false) or current_member.user_id is not null)
      and (normalized_query = '' or case normalized_field
        when 'description' then room.description
        when 'owner' then concat_ws(' ', owner.nickname, owner.handle)
        else room.name
      end ilike search_pattern escape E'\\')
  ),
  paged_rooms as (
    select *
    from matching_rooms
    order by
      case when coalesce(joined_only, false) then joined_sort_order end asc nulls last,
      case when coalesce(joined_only, false) then joined_at end asc nulls last,
      case when coalesce(joined_only, false) then id end asc,
      case when not coalesce(joined_only, false) then created_at end desc,
      case when not coalesce(joined_only, false) then id end desc
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
    'rooms', coalesce((select jsonb_agg(to_jsonb(directory_rows) order by
      case when coalesce(joined_only, false) then joined_sort_order end asc nulls last,
      case when coalesce(joined_only, false) then joined_at end asc nulls last,
      case when coalesce(joined_only, false) then id end asc,
      case when not coalesce(joined_only, false) then created_at end desc,
      case when not coalesce(joined_only, false) then id end desc
    ) from directory_rows), '[]'::jsonb),
    'total', (select count(*) from matching_rooms),
    'page', safe_page,
    'pageSize', safe_page_size
  ) into result;

  return result;
end;
$$;

grant select(sort_order) on public.study_members to authenticated;
revoke execute on function public.reorder_joined_studies(uuid[]) from public, anon;
grant execute on function public.reorder_joined_studies(uuid[]) to authenticated;
revoke execute on function public.study_room_directory(text, text, integer, integer, integer[], boolean) from public, anon;
grant execute on function public.study_room_directory(text, text, integer, integer, integer[], boolean) to authenticated;

commit;
