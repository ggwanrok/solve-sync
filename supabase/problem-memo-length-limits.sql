begin;

alter table public.problem_memos
  drop constraint if exists problem_memos_approach_length,
  drop constraint if exists problem_memos_solution_code_length,
  drop constraint if exists problem_memos_difficulty_reason_length,
  drop constraint if exists problem_memos_learnings_length;

update public.problem_memos
set approach = left(approach, 500),
    solution_code = left(solution_code, 10000),
    difficulty_reason = left(difficulty_reason, 500),
    learnings = left(learnings, 300);

alter table public.problem_memos
  add constraint problem_memos_approach_length check (char_length(approach) <= 500),
  add constraint problem_memos_solution_code_length check (char_length(solution_code) <= 10000),
  add constraint problem_memos_difficulty_reason_length check (char_length(difficulty_reason) <= 500),
  add constraint problem_memos_learnings_length check (char_length(learnings) <= 300);

commit;
