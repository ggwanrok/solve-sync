begin;

alter table public.solve_events
  add column if not exists solution_code text;

alter table public.solve_events drop constraint if exists solve_events_solution_code_length;
alter table public.solve_events
  add constraint solve_events_solution_code_length
  check (solution_code is null or char_length(solution_code) <= 50000);

create table if not exists public.problem_catalog (
  platform text not null default 'programmers',
  problem_id text not null,
  title text not null default '',
  url text not null,
  content text,
  difficulty smallint check (difficulty between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (platform, problem_id),
  constraint problem_catalog_title_length check (char_length(title) <= 200),
  constraint problem_catalog_content_length check (content is null or char_length(content) <= 30000)
);

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

alter table public.problem_catalog enable row level security;
alter table public.problem_memos enable row level security;

drop policy if exists problem_catalog_read_authenticated on public.problem_catalog;
create policy problem_catalog_read_authenticated
  on public.problem_catalog for select to authenticated using (true);

drop policy if exists problem_memos_self on public.problem_memos;
create policy problem_memos_self
  on public.problem_memos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.problem_catalog from authenticated;
grant select on public.problem_catalog to authenticated;
revoke all on public.problem_memos from authenticated;
grant select, insert, update, delete on public.problem_memos to authenticated;

commit;
