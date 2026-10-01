const assert = require("node:assert/strict")
const { test } = require("node:test")

test("프로그래머스의 프로그래밍·SQL 언어를 보존하고 공백을 정리한다", async () => {
  const { normalizeProgrammersLanguage } = await import("../lib/programmers-language.ts")
  for (const language of [
    "C", "C++", "C#", "Go", "Java", "JavaScript", "Kotlin", "Python", "Python2", "Python3",
    "Ruby", "Scala", "Swift", "MariaDB", "Microsoft SQL Server", "MSSQL", "MySQL", "Oracle",
    "Postgres", "PostgreSQL", "SQL", "SQL Server", "SQLite",
  ]) {
    assert.equal(normalizeProgrammersLanguage(`  ${language}  `), language)
  }
  assert.equal(normalizeProgrammersLanguage("Microsoft   SQL Server"), "Microsoft SQL Server")
  assert.equal(normalizeProgrammersLanguage("python3"), "python3")
})

test("문제 제목·탭 이름·관계없는 선택값을 언어로 저장하지 않는다", async () => {
  const { normalizeProgrammersLanguage } = await import("../lib/programmers-language.ts")
  for (const value of [null, undefined, "", " ", "조이스틱", "여행경로", "제출 내역", "recent", "JavaScript 문제", "SQL 문제", 123, {}]) {
    assert.equal(normalizeProgrammersLanguage(value), null)
  }
})
