const assert = require("node:assert/strict")
const { test } = require("node:test")

test("프로그래머스 풀이 언어를 코드 에디터 언어로 변환한다", async () => {
  const { codeLanguageMode } = await import("../lib/code-language.ts")
  const cases = [
    ["C", "c"],
    ["C++", "cpp"],
    ["C++17", "cpp"],
    ["C#", "csharp"],
    ["Go", "go"],
    ["Java", "java"],
    ["Java 17", "java"],
    ["JavaScript", "javascript"],
    ["JavaScript (Node.js)", "javascript"],
    ["Kotlin", "kotlin"],
    ["Python3", "python"],
    ["Ruby", "ruby"],
    ["Scala", "scala"],
    ["Swift", "swift"],
    ["MySQL", "mysql"],
    ["Oracle", "oracle"],
    ["PostgreSQL", "postgresql"],
    ["SQLite", "sqlite"],
    ["Microsoft SQL Server", "mssql"],
  ]

  for (const [language, expected] of cases) {
    assert.equal(codeLanguageMode(language), expected, language)
  }
})

test("언어 정보가 없거나 미지원 언어면 텍스트 모드를 사용한다", async () => {
  const { codeLanguageMode } = await import("../lib/code-language.ts")

  for (const language of [null, undefined, "", "   ", "Brainfuck", "지원하지 않는 언어"]) {
    assert.equal(codeLanguageMode(language), null)
  }
})
