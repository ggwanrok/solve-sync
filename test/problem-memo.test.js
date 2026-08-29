const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const { test } = require("node:test")

test("문제 메모 입력을 정리하고 허용 길이로 제한한다", async () => {
  const { normalizeProblemMemoInput, PROBLEM_MEMO_CODE_LIMIT, PROBLEM_MEMO_TEXT_LIMIT } = await import("../lib/problem-memo.ts")
  const memo = normalizeProblemMemoInput({
    problemId: " 12948 ",
    algorithmTags: " 문자열, 슬라이싱 ",
    approach: " 뒤 네 자리만 남긴다 ",
    solutionCode: "a".repeat(PROBLEM_MEMO_CODE_LIMIT + 20),
    difficultyReason: " 인덱스 범위를 잘못 계산했다 ",
    learnings: "b".repeat(PROBLEM_MEMO_TEXT_LIMIT + 20),
  })

  assert.equal(memo.problemId, "12948")
  assert.equal(memo.algorithmTags, "문자열, 슬라이싱")
  assert.equal(memo.approach, "뒤 네 자리만 남긴다")
  assert.equal(memo.solutionCode.length, PROBLEM_MEMO_CODE_LIMIT)
  assert.equal(memo.difficultyReason, "인덱스 범위를 잘못 계산했다")
  assert.equal(memo.learnings.length, PROBLEM_MEMO_TEXT_LIMIT)
})

test("허용하지 않는 문제 ID를 걸러낸다", async () => {
  const { normalizeProblemMemoInput, EMPTY_PROBLEM_MEMO } = await import("../lib/problem-memo.ts")

  assert.equal(normalizeProblemMemoInput({ problemId: "not-a-problem", ...EMPTY_PROBLEM_MEMO }), null)
})

test("문제 메모 스키마는 간소화된 다섯 항목만 저장한다", () => {
  const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8")
  const start = schema.indexOf("create table if not exists public.problem_memos")
  const end = schema.indexOf("create index if not exists problem_memos_user_updated_at", start)
  const memoTable = schema.slice(start, end)

  for (const column of ["algorithm_tags", "approach", "solution_code", "difficulty_reason", "learnings"]) {
    assert.match(memoTable, new RegExp(`\\b${column}\\b`))
  }
  for (const removedColumn of ["perceived_difficulty", "core_condition", "solution_approach", "quick_approach", "tips", "mistake_notes", "similar_problems"]) {
    assert.doesNotMatch(memoTable, new RegExp(`\\b${removedColumn}\\b`))
  }
  assert.match(memoTable, /char_length\(solution_code\) <= 20000/)
})
