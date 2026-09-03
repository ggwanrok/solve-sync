begin;

create or replace function public.cancel_friend_request(request_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  req public.friend_requests;
  removed_rows integer;
begin
  if current_user_id is null then raise exception '로그인이 필요합니다.' using errcode = '42501'; end if;

  select * into req
  from public.friend_requests
  where id = request_id and sender_id = current_user_id and status = 'pending';
  if req.id is null then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(req.sender_id::text, req.receiver_id::text) || ':' || greatest(req.sender_id::text, req.receiver_id::text),
    0
  ));

  delete from public.friend_requests
  where id = request_id and sender_id = current_user_id and status = 'pending';
  get diagnostics removed_rows = row_count;
  return removed_rows > 0;
end;
$$;

revoke execute on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

commit;
