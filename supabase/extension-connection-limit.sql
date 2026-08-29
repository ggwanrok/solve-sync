begin;

create or replace function public.enforce_extension_connection_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));

  if exists(
    select 1 from public.extension_connections connection
    where connection.user_id = new.user_id
      and connection.installation_id = new.installation_id
  ) then
    return new;
  end if;

  if (
    select count(*) from public.extension_connections connection
    where connection.user_id = new.user_id
  ) >= 5 then
    raise exception 'EXTENSION_CONNECTION_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists extension_connections_limit on public.extension_connections;
create trigger extension_connections_limit
before insert on public.extension_connections
for each row execute function public.enforce_extension_connection_limit();

revoke execute on function public.enforce_extension_connection_limit() from public, anon, authenticated;

commit;
