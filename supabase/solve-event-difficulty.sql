begin;

alter table public.solve_events
  add column if not exists difficulty smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'solve_events_difficulty_check'
      and conrelid = 'public.solve_events'::regclass
  ) then
    alter table public.solve_events
      add constraint solve_events_difficulty_check
      check (difficulty between 0 and 5);
  end if;
end
$$;

commit;
