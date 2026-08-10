begin;

create index if not exists study_rooms_created_at_desc
  on public.study_rooms(created_at desc, id desc);

create or replace function public.study_room_directory(
  directory_field text default 'title',
  directory_query text default '',
  page_number integer default 1,
  page_size integer default 12
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
      room.is_private,
      room.created_at,
      owner.handle as owner_handle,
      owner.nickname as owner_nickname
    from study_rooms room
    join profiles owner on owner.id = room.owner_id
    where normalized_query = '' or case normalized_field
      when 'description' then room.description
      when 'owner' then concat_ws(' ', owner.nickname, owner.handle)
      else room.name
    end ilike search_pattern escape E'\\'
  ),
  paged_rooms as (
    select *
    from matching_rooms
    order by created_at desc, id desc
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
    'rooms', coalesce((select jsonb_agg(to_jsonb(directory_rows) order by created_at desc, id desc) from directory_rows), '[]'::jsonb),
    'total', (select count(*) from matching_rooms),
    'page', safe_page,
    'pageSize', safe_page_size
  ) into result;

  return result;
end;
$$;

revoke execute on function public.study_room_directory(text, text, integer, integer) from public, anon;
grant execute on function public.study_room_directory(text, text, integer, integer) to authenticated;

commit;
