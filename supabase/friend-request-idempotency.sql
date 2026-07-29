begin;

drop function if exists public.send_friend_request(text);
create function public.send_friend_request(target_handle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  target_id uuid;
  pending_request public.friend_requests;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;
  select id into target_id from profiles where handle = regexp_replace(lower(trim(target_handle)), '^@+', '');
  if target_id is null then return jsonb_build_object('status', 'not_found'); end if;
  if target_id = current_user_id then return jsonb_build_object('status', 'self'); end if;

  -- 같은 두 사용자의 요청/수락을 직렬화해 교차 요청과 수락 경합도 한 상태로 처리한다.
  perform pg_advisory_xact_lock(hashtextextended(
    least(current_user_id::text, target_id::text) || ':' || greatest(current_user_id::text, target_id::text),
    0
  ));

  if exists(select 1 from friendships where user_id = current_user_id and friend_id = target_id) then
    return jsonb_build_object('status', 'already_friends');
  end if;

  select * into pending_request
  from friend_requests
  where status = 'pending'
    and least(sender_id, receiver_id) = least(current_user_id, target_id)
    and greatest(sender_id, receiver_id) = greatest(current_user_id, target_id)
  for update;

  if pending_request.id is not null then
    return jsonb_build_object(
      'status', case when pending_request.sender_id = current_user_id then 'already_sent' else 'incoming_pending' end,
      'request_id', pending_request.id
    );
  end if;

  insert into friend_requests(sender_id, receiver_id)
  values(current_user_id, target_id)
  returning * into pending_request;

  return jsonb_build_object('status', 'sent', 'request_id', pending_request.id);
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  req friend_requests;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;

  select * into req from friend_requests where id = request_id and receiver_id = current_user_id and status = 'pending';
  if req.id is null then raise exception '처리할 수 없는 친구 요청입니다.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(req.sender_id::text, req.receiver_id::text) || ':' || greatest(req.sender_id::text, req.receiver_id::text),
    0
  ));

  select * into req from friend_requests where id = request_id and receiver_id = current_user_id and status = 'pending' for update;
  if req.id is null then raise exception '처리할 수 없는 친구 요청입니다.'; end if;
  update friend_requests set status = case when accept then 'accepted' else 'declined' end, responded_at = now() where id = req.id;
  if accept then
    insert into friendships(user_id, friend_id) values(req.sender_id, req.receiver_id),(req.receiver_id, req.sender_id) on conflict do nothing;
  end if;
end;
$$;

revoke execute on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

commit;
