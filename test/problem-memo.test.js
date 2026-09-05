const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const { test } = require("node:test")

test("문제 메모 입력을 정리하고 허용 길이로 제한한다", async () => {
  const {
    normalizeProblemMemoInput,
    PROBLEM_MEMO_APPROACH_LIMIT,
    PROBLEM_MEMO_CODE_LIMIT,
    PROBLEM_MEMO_DIFFICULTY_REASON_LIMIT,
    PROBLEM_MEMO_LEARNINGS_LIMIT,
  } = await import("../lib/problem-memo.ts")
  const memo = normalizeProblemMemoInput({
    problemId: " 12948 ",
    algorithmTags: " 문자열, 슬라이싱 ",
    approach: ` ${"a".repeat(PROBLEM_MEMO_APPROACH_LIMIT + 20)} `,
    solutionCode: "a".repeat(PROBLEM_MEMO_CODE_LIMIT + 20),
    difficultyReason: "b".repeat(PROBLEM_MEMO_DIFFICULTY_REASON_LIMIT + 20),
    learnings: "c".repeat(PROBLEM_MEMO_LEARNINGS_LIMIT + 20),
  })

  assert.equal(memo.problemId, "12948")
  assert.equal(memo.algorithmTags, "문자열, 슬라이싱")
  assert.equal(memo.approach.length, PROBLEM_MEMO_APPROACH_LIMIT)
  assert.equal(memo.solutionCode.length, PROBLEM_MEMO_CODE_LIMIT)
  assert.equal(memo.difficultyReason.length, PROBLEM_MEMO_DIFFICULTY_REASON_LIMIT)
  assert.equal(memo.learnings.length, PROBLEM_MEMO_LEARNINGS_LIMIT)
})

test("허용하지 않는 문제 ID를 걸러낸다", async () => {
  const { normalizeProblemMemoInput, EMPTY_PROBLEM_MEMO } = await import("../lib/problem-memo.ts")

  assert.equal(normalizeProblemMemoInput({ problemId: "not-a-problem", ...EMPTY_PROBLEM_MEMO }), null)
})

test("문제 메모 필터와 북마크 목록은 독립적으로 검색하고 분류한다", async () => {
  const { filterProblemNotes, filterBookmarkedProblems, EMPTY_PROBLEM_MEMO } = await import("../lib/problem-memo.ts")
  const problems = [
    { problemId: "1", title: "문자열", acceptedAt: "2026-09-01T00:00:00Z", needsReview: true, memo: null },
    { problemId: "2", title: "정렬", acceptedAt: "2026-09-04T00:00:00Z", needsReview: false, memo: { ...EMPTY_PROBLEM_MEMO, algorithmTags: "정렬" } },
    { problemId: "3", title: "최단 경로", acceptedAt: "2026-09-02T00:00:00Z", needsReview: true, memo: { ...EMPTY_PROBLEM_MEMO, algorithmTags: "BFS" } },
    { problemId: "4", title: "집계", acceptedAt: "2026-09-03T00:00:00Z", needsReview: false, memo: null },
  ]
  const ids = (filter, query = "") => filterProblemNotes(problems, filter, query).map((problem) => problem.problemId)
  const bookmarkIds = (query = "") => filterBookmarkedProblems(problems, query).map((problem) => problem.problemId)
  assert.deepEqual(ids("all"), ["2", "4", "3", "1"])
  assert.deepEqual(ids("written"), ["2", "3"])
  assert.deepEqual(ids("empty"), ["4", "1"])
  assert.deepEqual(bookmarkIds(), ["3", "1"])
  assert.deepEqual(bookmarkIds(" bfs "), ["3"])
  assert.deepEqual(bookmarkIds("문자열"), ["1"])
  assert.deepEqual(bookmarkIds("정렬"), [])

  problems[0].needsReview = false
  assert.deepEqual(bookmarkIds(), ["3"])
  assert.deepEqual(ids("empty"), ["4", "1"])
})

test("북마크와 메모 여부가 바뀌어도 풀이 인증시간 최신순과 원본 목록을 유지한다", async () => {
  const { filterProblemNotes, EMPTY_PROBLEM_MEMO } = await import("../lib/problem-memo.ts")
  const memo = { ...EMPTY_PROBLEM_MEMO, approach: "풀이 기록" }
  const problems = Object.freeze([
    { problemId: "1", acceptedAt: "2026-09-01T00:00:00Z", needsReview: false, memo: null },
    { problemId: "2", acceptedAt: "2026-09-08T00:00:00Z", needsReview: false, memo },
    { problemId: "3", acceptedAt: "2026-09-03T00:00:00Z", needsReview: true, memo: null },
    { problemId: "4", acceptedAt: "2026-09-06T00:00:00Z", needsReview: true, memo },
    { problemId: "5", acceptedAt: "2026-09-05T00:00:00Z", needsReview: false, memo: null },
    { problemId: "6", acceptedAt: "2026-09-02T00:00:00Z", needsReview: false, memo },
    { problemId: "7", acceptedAt: "2026-09-07T00:00:00Z", needsReview: true, memo: null },
    { problemId: "8", acceptedAt: "2026-09-04T00:00:00Z", needsReview: true, memo },
  ])
  const ids = () => filterProblemNotes(problems, "all", "").map((problem) => problem.problemId)
  assert.deepEqual(ids(), ["2", "7", "4", "5", "8", "3", "6", "1"])
  assert.deepEqual(problems.map((problem) => problem.problemId), ["1", "2", "3", "4", "5", "6", "7", "8"])

  problems[1].needsReview = true
  problems[2].memo = memo
  problems[3].needsReview = false
  assert.deepEqual(ids(), ["2", "7", "4", "5", "8", "3", "6", "1"])
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
  assert.match(memoTable, /char_length\(approach\) <= 500/)
  assert.match(memoTable, /char_length\(solution_code\) <= 10000/)
  assert.match(memoTable, /char_length\(difficulty_reason\) <= 500/)
  assert.match(memoTable, /char_length\(learnings\) <= 300/)
})
