begin;

create table if not exists public.problem_memos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'programmers',
  problem_id text not null,
  perceived_difficulty smallint check (perceived_difficulty between 1 and 5),
  algorithm_tags text not null default '',
  core_condition text not null default '',
  solution_approach text not null default '',
  quick_approach text not null default '',
  tips text not null default '',
  mistake_notes text not null default '',
  similar_problems text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, platform, problem_id),
  foreign key (user_id, platform, problem_id)
    references public.solve_events(user_id, platform, problem_id) on delete cascade,
  constraint problem_memos_algorithm_tags_length check (char_length(algorithm_tags) <= 300),
  constraint problem_memos_core_condition_length check (char_length(core_condition) <= 2000),
  constraint problem_memos_solution_approach_length check (char_length(solution_approach) <= 2000),
  constraint problem_memos_quick_approach_length check (char_length(quick_approach) <= 2000),
  constraint problem_memos_tips_length check (char_length(tips) <= 2000),
  constraint problem_memos_mistake_notes_length check (char_length(mistake_notes) <= 2000),
  constraint problem_memos_similar_problems_length check (char_length(similar_problems) <= 2000)
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
