begin;

alter table public.solve_events
  add column if not exists problem_type text;

update public.solve_events
set problem_type = case
  when lower(btrim(coalesce(language, ''))) in ('mariadb', 'microsoft sql server', 'mssql', 'mysql', 'oracle', 'postgres', 'postgresql', 'sql', 'sql server', 'sqlite') then 'sql'
  else 'algorithm'
end
where problem_type is null;

alter table public.solve_events
  alter column problem_type set default 'algorithm',
  alter column problem_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'solve_events_problem_type_check'
      and conrelid = 'public.solve_events'::regclass
  ) then
    alter table public.solve_events
      add constraint solve_events_problem_type_check
      check (problem_type in ('algorithm', 'sql'));
  end if;
end
$$;

create index if not exists solve_events_user_problem_type_accepted_at
  on public.solve_events(user_id, problem_type, accepted_at desc);

commit;
