const assert = require("node:assert/strict")
const { test } = require("node:test")

test("문제 메모 입력을 정리하고 허용 길이로 제한한다", async () => {
  const { normalizeProblemMemoInput, PROBLEM_MEMO_TEXT_LIMIT } = await import("../lib/problem-memo.ts")
  const memo = normalizeProblemMemoInput({
    problemId: " 12948 ",
    perceivedDifficulty: 3,
    algorithmTags: " 문자열, 슬라이싱 ",
    coreCondition: "a".repeat(PROBLEM_MEMO_TEXT_LIMIT + 20),
    solutionApproach: " 뒤 네 자리만 남긴다 ",
    quickApproach: "",
    tips: "",
    mistakeNotes: "",
    similarProblems: "",
  })

  assert.equal(memo.problemId, "12948")
  assert.equal(memo.perceivedDifficulty, 3)
  assert.equal(memo.algorithmTags, "문자열, 슬라이싱")
  assert.equal(memo.coreCondition.length, PROBLEM_MEMO_TEXT_LIMIT)
  assert.equal(memo.solutionApproach, "뒤 네 자리만 남긴다")
})

test("허용하지 않는 문제 ID와 체감 난이도를 걸러낸다", async () => {
  const { normalizeProblemMemoInput, EMPTY_PROBLEM_MEMO } = await import("../lib/problem-memo.ts")

  assert.equal(normalizeProblemMemoInput({ problemId: "not-a-problem", ...EMPTY_PROBLEM_MEMO }), null)
  assert.equal(normalizeProblemMemoInput({ problemId: "12948", ...EMPTY_PROBLEM_MEMO, perceivedDifficulty: 9 }).perceivedDifficulty, null)
})
