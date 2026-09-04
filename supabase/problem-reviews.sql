begin;

-- 복습 지정은 메모 작성 여부와 독립적으로 관리한다.
create table if not exists public.problem_reviews (
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'programmers',
  problem_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, platform, problem_id),
  foreign key (user_id, platform, problem_id)
    references public.solve_events(user_id, platform, problem_id) on delete cascade
);

alter table public.problem_reviews enable row level security;

drop policy if exists problem_reviews_self on public.problem_reviews;
create policy problem_reviews_self on public.problem_reviews for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.problem_reviews from public, anon, authenticated;
grant select, insert, delete on public.problem_reviews to authenticated;
grant all on public.problem_reviews to service_role;

commit;
