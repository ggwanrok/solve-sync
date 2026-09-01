begin;

alter table public.profiles
  add column if not exists problem_memo_prompt_enabled boolean not null default false;

grant update(problem_memo_prompt_enabled) on public.profiles to authenticated;

commit;
