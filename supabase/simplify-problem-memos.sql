begin;

alter table public.problem_memos
  drop constraint if exists problem_memos_core_condition_length,
  drop constraint if exists problem_memos_solution_approach_length,
  drop constraint if exists problem_memos_quick_approach_length,
  drop constraint if exists problem_memos_tips_length,
  drop constraint if exists problem_memos_mistake_notes_length,
  drop constraint if exists problem_memos_similar_problems_length;

alter table public.problem_memos
  drop column if exists perceived_difficulty,
  drop column if exists core_condition,
  drop column if exists solution_approach,
  drop column if exists quick_approach,
  drop column if exists tips,
  drop column if exists mistake_notes,
  drop column if exists similar_problems,
  add column if not exists approach text not null default '',
  add column if not exists solution_code text not null default '',
  add column if not exists difficulty_reason text not null default '',
  add column if not exists learnings text not null default '';

alter table public.problem_memos
  drop constraint if exists problem_memos_approach_length,
  drop constraint if exists problem_memos_solution_code_length,
  drop constraint if exists problem_memos_difficulty_reason_length,
  drop constraint if exists problem_memos_learnings_length;

alter table public.problem_memos
  add constraint problem_memos_approach_length check (char_length(approach) <= 2000),
  add constraint problem_memos_solution_code_length check (char_length(solution_code) <= 20000),
  add constraint problem_memos_difficulty_reason_length check (char_length(difficulty_reason) <= 2000),
  add constraint problem_memos_learnings_length check (char_length(learnings) <= 2000);

commit;
