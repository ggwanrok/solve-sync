begin;

-- 스터디 생성/참여는 검증 로직이 있는 RPC로만 수행한다.
drop policy if exists study_rooms_create on public.study_rooms;
drop policy if exists study_rooms_update_owner on public.study_rooms;
drop policy if exists study_members_join_self on public.study_members;

revoke all on public.study_rooms from authenticated;
grant select(id, owner_id, name, description, emoji, weekly_goal, max_members, is_private, created_at, goal_period, goal_count)
  on public.study_rooms to authenticated;

revoke all on public.study_members from authenticated;
grant select on public.study_members to authenticated;

-- 핸들은 claim_handle RPC로만 최초 설정하고 일반 프로필 수정에서 제외한다.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(nickname, avatar_url, guide_completed_at) on public.profiles to authenticated;

-- SECURITY DEFINER 함수의 PostgreSQL 기본 PUBLIC 실행 권한을 제거한다.
revoke execute on function public.claim_handle(text) from public, anon;
revoke execute on function public.is_handle_available(text) from public, anon;
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.is_study_member(uuid) from public, anon;
revoke execute on function public.create_study_room(text, text, integer, text, text) from public, anon;
revoke execute on function public.delete_own_account() from public, anon;
revoke execute on function public.has_study_room_access(uuid) from public, anon;
revoke execute on function public.verify_study_room_password(uuid, text) from public, anon;
revoke execute on function public.join_study_room(uuid) from public, anon;
revoke execute on function public.delete_study_room(uuid) from public, anon;
revoke execute on function public.leave_study_room(uuid) from public, anon;
revoke execute on function public.study_member_goal_progress(uuid) from public, anon;

-- 풀이 기록은 Vercel 서버의 Secret Key 경로만 사용한다.
revoke execute on function public.record_programmers_event(text, text, text, text, text, timestamptz, integer, timestamptz)
  from public, anon, authenticated;

commit;
