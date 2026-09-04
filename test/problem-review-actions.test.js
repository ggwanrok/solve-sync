const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { runInNewContext } = require("node:vm")
const { test } = require("node:test")
const ts = require("typescript")

function reviewAction({ user = { id: "viewer" }, error = null } = {}) {
  const reviews = new Set()
  const invalidated = []
  const source = ts.transpileModule(readFileSync("app/problem-review-actions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  const supabase = {
    from(table) {
      assert.equal(table, "problem_reviews", "복습 지정은 메모나 풀이 데이터를 변경하지 않는다")
      return {
        async upsert(row, options) {
          assert.equal(row.user_id, user.id)
          assert.equal(row.platform, "programmers")
          assert.equal(options.ignoreDuplicates, true)
          if (!error) reviews.add(row.problem_id)
          return { error }
        },
        delete() {
          const filters = {}
          return {
            eq(key, value) { filters[key] = value; return this },
            then(resolve) {
              assert.equal(filters.user_id, user.id)
              assert.equal(filters.platform, "programmers")
              if (!error) reviews.delete(filters.problem_id)
              return Promise.resolve({ error }).then(resolve)
            },
          }
        },
      }
    },
  }
  runInNewContext(source, {
    exports, console: { error() {} },
    require(name) {
      if (name === "next/cache") return { revalidatePath: (path) => invalidated.push(path) }
      if (name === "@/lib/server/viewer") return { getViewer: async () => ({ user, supabase }) }
      throw new Error(`Unexpected module: ${name}`)
    },
  })
  return { setReview: exports.setProblemReview, reviews, invalidated }
}

test("복습 지정과 해제는 재시도해도 안전하며 두 화면을 갱신한다", async () => {
  const { setReview, reviews, invalidated } = reviewAction()
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await setReview("12948", true)
    assert.equal(result.ok, true)
    assert.equal(result.needsReview, true)
    assert.equal(reviews.size, 1)
  }
  assert.deepEqual(invalidated, ["/", "/notes", "/", "/notes"])
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await setReview("12948", false)
    assert.equal(result.ok, true)
    assert.equal(result.needsReview, false)
    assert.equal(reviews.size, 0)
  }
})

test("로그인, 입력, 저장 오류를 성공으로 처리하지 않는다", async () => {
  const invalid = reviewAction()
  for (const [problemId, needsReview] of [[null, true], ["", true], ["bad-id", true], ["1".repeat(101), true], ["1", "true"]]) {
    assert.equal((await invalid.setReview(problemId, needsReview)).ok, false)
  }
  assert.equal(invalid.reviews.size, 0)
  assert.equal(invalid.invalidated.length, 0)
  assert.equal((await reviewAction({ user: null }).setReview("1", true)).ok, false)
  const failed = reviewAction({ error: { code: "42501" } })
  assert.equal((await failed.setReview("1", true)).ok, false)
  assert.equal(failed.reviews.size, 0)
  assert.equal(failed.invalidated.length, 0)
})
