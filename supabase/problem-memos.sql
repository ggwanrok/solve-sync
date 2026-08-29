begin;

create table if not exists public.problem_memos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'programmers',
  problem_id text not null,
  algorithm_tags text not null default '',
  approach text not null default '',
  solution_code text not null default '',
  difficulty_reason text not null default '',
  learnings text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, platform, problem_id),
  foreign key (user_id, platform, problem_id)
    references public.solve_events(user_id, platform, problem_id) on delete cascade,
  constraint problem_memos_algorithm_tags_length check (char_length(algorithm_tags) <= 300),
  constraint problem_memos_approach_length check (char_length(approach) <= 2000),
  constraint problem_memos_solution_code_length check (char_length(solution_code) <= 20000),
  constraint problem_memos_difficulty_reason_length check (char_length(difficulty_reason) <= 2000),
  constraint problem_memos_learnings_length check (char_length(learnings) <= 2000)
);

create index if not exists problem_memos_user_updated_at
  on public.problem_memos(user_id, updated_at desc);

alter table public.problem_memos enable row level security;

drop policy if exists problem_memos_self on public.problem_memos;
create policy problem_memos_self
  on public.problem_memos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.problem_memos from authenticated;
grant select, insert, update, delete on public.problem_memos to authenticated;

commit;
