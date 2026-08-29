-- SolveSync 확장 프로그램 다중 기기 연결 및 일회용 승인 코드
begin;

alter table public.extension_connections
  add column if not exists installation_id uuid default gen_random_uuid(),
  add column if not exists device_name text default '기존 기기';

update public.extension_connections
set installation_id = gen_random_uuid()
where installation_id is null;

update public.extension_connections
set device_name = '기존 기기'
where device_name is null or btrim(device_name) = '';

alter table public.extension_connections
  alter column installation_id set default gen_random_uuid(),
  alter column installation_id set not null,
  alter column device_name set default '기존 기기',
  alter column device_name set not null;

alter table public.extension_connections
  drop constraint if exists extension_connections_device_name_check;
alter table public.extension_connections
  add constraint extension_connections_device_name_check check (char_length(device_name) between 1 and 80);

alter table public.extension_connections drop constraint if exists extension_connections_pkey;
alter table public.extension_connections add primary key (user_id, installation_id);

create index if not exists extension_connections_user_created_at
  on public.extension_connections(user_id, created_at desc);

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

revoke all on public.extension_connections from authenticated;
grant select, delete on public.extension_connections to authenticated;

create table if not exists public.extension_connection_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id uuid not null,
  device_name text not null check (char_length(device_name) between 1 and 80),
  code_hash text not null unique,
  code_challenge text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists extension_connection_codes_expiry
  on public.extension_connection_codes(expires_at) where used_at is null;

alter table public.extension_connection_codes enable row level security;
revoke all on public.extension_connection_codes from public, anon, authenticated;
grant all on public.extension_connection_codes to service_role;

create or replace function public.exchange_extension_connection_code(
  presented_code_hash text,
  presented_code_challenge text,
  presented_installation_id uuid,
  issued_token_hash text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  connection_code extension_connection_codes%rowtype;
  connected_at timestamptz := now();
begin
  update extension_connection_codes
  set used_at = connected_at
  where code_hash = presented_code_hash
    and code_challenge = presented_code_challenge
    and installation_id = presented_installation_id
    and used_at is null
    and expires_at > connected_at
  returning * into connection_code;

  if not found then return null; end if;

  insert into extension_connections(user_id, installation_id, device_name, token_hash, created_at, last_seen_at)
  values(connection_code.user_id, connection_code.installation_id, connection_code.device_name, issued_token_hash, connected_at, null)
  on conflict(user_id, installation_id) do update
  set device_name = excluded.device_name,
      token_hash = excluded.token_hash,
      created_at = excluded.created_at,
      last_seen_at = null;

  return jsonb_build_object(
    'installationId', connection_code.installation_id,
    'deviceName', connection_code.device_name,
    'connectedAt', connected_at
  );
end;
$$;

revoke execute on function public.exchange_extension_connection_code(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.exchange_extension_connection_code(text, text, uuid, text) to service_role;

create or replace function public.record_programmers_event(
  auth_token_hash text,
  event_problem_id text,
  event_title text,
  event_url text,
  event_language text,
  event_started_at timestamptz,
  event_duration_seconds integer,
  event_accepted_at timestamptz
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target_user uuid; inserted_id uuid;
begin
  select user_id into target_user from extension_connections where token_hash = auth_token_hash;
  if target_user is null then raise exception '유효하지 않은 익스텐션 토큰입니다.' using errcode = '28000'; end if;
  update extension_connections set last_seen_at = now() where token_hash = auth_token_hash;
  insert into solve_events(user_id, problem_id, title, url, language, started_at, duration_seconds, accepted_at)
  values(target_user, event_problem_id, left(event_title, 200), event_url, event_language, event_started_at, event_duration_seconds, event_accepted_at)
  on conflict(user_id, platform, problem_id) do nothing returning id into inserted_id;
  return jsonb_build_object('id', inserted_id, 'duplicate', inserted_id is null);
end;
$$;

commit;
