const assert = require("node:assert/strict")
const { test } = require("node:test")
const { createClient } = require("@supabase/supabase-js")

function fixtureClient(failingTable) {
  const solves = Array.from({ length: 1005 }, (_, index) => ({
    id: `solve-${index}`, user_id: "viewer", platform: "programmers", problem_id: String(index),
    title: `문제 ${index}`, url: `https://example.com/${index}`, language: "Python",
    problem_type: "algorithm", difficulty: 1, accepted_at: "2026-09-01T00:00:00Z",
  }))
  const rows = {
    solve_events: solves,
    problem_memos: [{
      user_id: "viewer", platform: "programmers", problem_id: "1004",
      algorithm_tags: "BFS", approach: "큐 사용", solution_code: "", difficulty_reason: "", learnings: "",
      updated_at: "2026-09-02T00:00:00Z",
    }],
    problem_reviews: [
      { user_id: "viewer", platform: "programmers", problem_id: "1003" },
      { user_id: "viewer", platform: "programmers", problem_id: "1004" },
      { user_id: "other", platform: "programmers", problem_id: "1" },
    ],
  }
  return createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(input)
      const table = url.pathname.split("/").at(-1)
      if (table === failingTable) return Response.json({ message: "unavailable" }, { status: 400 })
      let result = rows[table]
      for (const [key, value] of url.searchParams) {
        if (value.startsWith("eq.")) result = result.filter((row) => row[key] === value.slice(3))
        if (value.startsWith("in.(")) {
          const values = value.slice(4, -1).split(",")
          result = result.filter((row) => values.includes(row[key]))
        }
      }
      const offset = Number(url.searchParams.get("offset") || 0)
      const limit = Math.min(Number(url.searchParams.get("limit") || 1000), 1000)
      return Response.json(result.slice(offset, offset + limit))
    } },
  })
}

test("1000개를 넘는 풀이에서도 오래된 복습 문제와 메모를 빠짐없이 가져온다", async () => {
  const { loadProblemNotes } = await import("../lib/server/problem-notes.ts")
  const { filterBookmarkedProblems } = await import("../lib/problem-memo.ts")
  const problems = await loadProblemNotes(fixtureClient(), "viewer")
  assert.equal(problems.length, 1005)
  assert.equal(new Set(problems.map((problem) => problem.id)).size, 1005)
  assert.deepEqual(filterBookmarkedProblems(problems, "").map((problem) => problem.problemId), ["1003", "1004"])
  assert.equal(problems[1003].memo, null)
  assert.equal(problems[1004].memo.approach, "큐 사용")
  assert.equal(problems[1].needsReview, false)
})

test("조회 실패를 미작성이나 복습 미지정으로 처리하지 않는다", async () => {
  const { loadProblemNotes } = await import("../lib/server/problem-notes.ts")
  for (const table of ["solve_events", "problem_memos", "problem_reviews"]) {
    await assert.rejects(loadProblemNotes(fixtureClient(table), "viewer"), /불러오지 못했습니다/)
  }
})
