const assert = require("node:assert/strict")
const { test } = require("node:test")

test("프로그래밍 언어는 알고리즘 문제로 분류한다", async () => {
  const { problemTypeFromLanguage } = await import("../lib/problem-type.ts")

  assert.equal(problemTypeFromLanguage("JavaScript"), "algorithm")
  assert.equal(problemTypeFromLanguage("Python3"), "algorithm")
  assert.equal(problemTypeFromLanguage(null), "algorithm")
})

test("SQL 계열 언어는 SQL 문제로 분류한다", async () => {
  const { problemTypeFromLanguage } = await import("../lib/problem-type.ts")

  assert.equal(problemTypeFromLanguage("MySQL"), "sql")
  assert.equal(problemTypeFromLanguage(" oracle "), "sql")
  assert.equal(problemTypeFromLanguage("PostgreSQL"), "sql")
})
