begin;

create index if not exists study_comments_study_created_at
  on public.study_comments(study_id, created_at desc);

create or replace function public.study_room_detail(target_study uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  target_room study_rooms;
  is_member boolean;
  can_view boolean;
  period_unit text;
  period_step interval;
  current_period_local timestamp;
  current_period_start timestamptz;
  current_period_end timestamptz;
  members_json jsonb := '[]'::jsonb;
  progress_json jsonb := '[]'::jsonb;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;

  select * into target_room from study_rooms where id = target_study;
  if target_room.id is null then return jsonb_build_object('room', null); end if;

  select exists(
    select 1 from study_members member
    where member.study_id = target_study and member.user_id = current_user_id
  ) into is_member;

  can_view := not target_room.is_private or is_member or exists(
    select 1 from study_room_access access
    where access.study_id = target_study and access.user_id = current_user_id
  );

  if not can_view then
    return jsonb_build_object(
      'room', jsonb_build_object('id', target_room.id, 'name', target_room.name, 'isPrivate', true),
      'members', '[]'::jsonb,
      'progress', '[]'::jsonb,
      'isMember', false,
      'canView', false,
      'currentPeriod', null
    );
  end if;

  period_unit := case when target_room.goal_period = 'daily' then 'day' else 'week' end;
  period_step := case when target_room.goal_period = 'daily' then interval '1 day' else interval '1 week' end;
  current_period_local := date_trunc(period_unit, now() at time zone 'Asia/Seoul');
  current_period_start := current_period_local at time zone 'Asia/Seoul';
  current_period_end := (current_period_local + period_step) at time zone 'Asia/Seoul';

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', member.user_id,
    'role', member.role,
    'joinedAt', member.joined_at,
    'profile', jsonb_build_object(
      'handle', profile.handle,
      'nickname', profile.nickname,
      'avatar_url', profile.avatar_url
    )
  ) order by member.joined_at, member.user_id), '[]'::jsonb)
  into members_json
  from study_members member
  join profiles profile on profile.id = member.user_id
  where member.study_id = target_study;

  if is_member then
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', progress.user_id,
      'solvedCount', progress.solved_count
    ) order by progress.user_id), '[]'::jsonb)
    into progress_json
    from (
      select member.user_id, count(distinct event.problem_id)::bigint as solved_count
      from study_members member
      left join solve_events event
        on event.user_id = member.user_id
        and event.accepted_at >= current_period_start
        and event.accepted_at < current_period_end
      where member.study_id = target_study
      group by member.user_id
    ) progress;
  end if;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', target_room.id,
      'ownerId', target_room.owner_id,
      'name', target_room.name,
      'description', target_room.description,
      'goalPeriod', target_room.goal_period,
      'goalCount', target_room.goal_count,
      'isPrivate', target_room.is_private
    ),
    'members', members_json,
    'progress', progress_json,
    'isMember', is_member,
    'canView', true,
    'currentPeriod', jsonb_build_object('start', current_period_start, 'end', current_period_end)
  );
end;
$$;

create or replace function public.study_goal_history_page(
  target_study uuid,
  page_number integer default 1,
  page_size integer default 5,
  history_order text default 'newest'
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  target_room record;
  period_unit text;
  period_step interval;
  first_period_local timestamp;
  current_period_local timestamp;
  total_periods integer;
  safe_page integer := greatest(1, coalesce(page_number, 1));
  safe_page_size integer := greatest(1, least(coalesce(page_size, 5), 10));
  safe_order text := case when history_order = 'oldest' then 'oldest' else 'newest' end;
  start_position integer;
  result jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if not public.is_study_member(target_study) then raise exception '스터디 멤버만 지난 기록을 볼 수 있습니다.'; end if;

  select room.created_at, room.goal_period into target_room
  from study_rooms room where room.id = target_study;
  if target_room.created_at is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;

  period_unit := case when target_room.goal_period = 'daily' then 'day' else 'week' end;
  period_step := case when target_room.goal_period = 'daily' then interval '1 day' else interval '1 week' end;
  first_period_local := date_trunc(period_unit, target_room.created_at at time zone 'Asia/Seoul');
  current_period_local := date_trunc(period_unit, now() at time zone 'Asia/Seoul');
  total_periods := greatest(0, floor(extract(epoch from (current_period_local - first_period_local)) / extract(epoch from period_step))::integer);
  start_position := (safe_page - 1) * safe_page_size;

  with page_positions as (
    select position
    from generate_series(start_position, least(total_periods - 1, start_position + safe_page_size - 1)) position
  ),
  periods as (
    select
      case when safe_order = 'oldest' then total_periods - position else position + 1 end as period_offset
    from page_positions
  ),
  period_bounds as (
    select
      (current_period_local - period_step * period_offset) at time zone 'Asia/Seoul' as period_start,
      (current_period_local - period_step * period_offset + period_step) at time zone 'Asia/Seoul' as period_end,
      total_periods - period_offset + 1 as period_number
    from periods
  ),
  history_rows as (
    select
      period.period_start,
      period.period_end,
      period.period_number,
      history.user_id,
      history.role,
      profile.handle,
      profile.nickname,
      profile.avatar_url,
      count(distinct event.problem_id)::bigint as solved_count
    from period_bounds period
    join study_membership_history history
      on history.study_id = target_study
      and history.joined_at < period.period_end
      and coalesce(history.left_at, 'infinity'::timestamptz) > period.period_start
    join profiles profile on profile.id = history.user_id
    left join solve_events event
      on event.user_id = history.user_id
      and event.accepted_at >= period.period_start
      and event.accepted_at < period.period_end
    group by period.period_start, period.period_end, period.period_number,
      history.user_id, history.role, profile.handle, profile.nickname, profile.avatar_url
  )
  select jsonb_build_object(
    'entries', coalesce(jsonb_agg(to_jsonb(history_rows) order by
      case when safe_order = 'newest' then period_number end desc,
      case when safe_order = 'oldest' then period_number end asc,
      nickname,
      handle
    ), '[]'::jsonb),
    'page', safe_page,
    'pageSize', safe_page_size,
    'totalPeriods', total_periods,
    'totalPages', case when total_periods = 0 then 0 else ceil(total_periods::numeric / safe_page_size)::integer end
  ) into result
  from history_rows;

  return result;
end;
$$;

drop function if exists public.study_member_period_solve_events(uuid, uuid, timestamptz);
create function public.study_member_period_solve_events(
  target_study uuid,
  target_user uuid,
  target_period_start timestamptz
)
returns table(
  problem_id text,
  title text,
  url text,
  language text,
  problem_type text,
  accepted_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  target_period text;
  period_start timestamptz;
  period_end timestamptz;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  if not public.is_study_member(target_study) then raise exception '스터디 멤버만 풀이 상세를 볼 수 있습니다.'; end if;

  select room.goal_period into target_period from study_rooms room where room.id = target_study;
  if target_period is null then raise exception '존재하지 않는 스터디룸입니다.'; end if;

  period_start := date_trunc(case when target_period = 'daily' then 'day' else 'week' end, target_period_start at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  period_end := (period_start at time zone 'Asia/Seoul' + case when target_period = 'daily' then interval '1 day' else interval '1 week' end) at time zone 'Asia/Seoul';

  if not exists (
    select 1 from study_membership_history history
    where history.study_id = target_study
      and history.user_id = target_user
      and history.joined_at < period_end
      and coalesce(history.left_at, 'infinity'::timestamptz) > period_start
  ) then return; end if;

  return query
  select event.problem_id, event.title, event.url, event.language, event.problem_type, event.accepted_at
  from solve_events event
  where event.user_id = target_user
    and event.accepted_at >= period_start
    and event.accepted_at < period_end
  order by event.accepted_at desc;
end;
$$;

revoke execute on function public.study_room_detail(uuid) from public, anon;
grant execute on function public.study_room_detail(uuid) to authenticated;
revoke execute on function public.study_goal_history_page(uuid, integer, integer, text) from public, anon;
grant execute on function public.study_goal_history_page(uuid, integer, integer, text) to authenticated;
revoke execute on function public.study_member_period_solve_events(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.study_member_period_solve_events(uuid, uuid, timestamptz) to authenticated;

commit;
