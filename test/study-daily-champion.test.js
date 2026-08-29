const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { test } = require("node:test")
const { join } = require("node:path")

function championFunctionFromSchema() {
  const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8")
  const start = schema.indexOf("create function public.study_daily_champions")
  const end = schema.indexOf("drop function if exists public.claim_study_notifications", start)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  return schema.slice(start, end)
}

test("오늘의 풀이왕은 스터디 목표 조건과 관계없이 오늘 전체 풀이로 선정한다", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/study-daily-champion-independent-of-goal.sql"),
    "utf8",
  )
  const schemaFunction = championFunctionFromSchema()

  for (const sql of [migration, schemaFunction]) {
    assert.doesNotMatch(sql, /goal_count/)
    assert.doesNotMatch(sql, /min_difficulty/)
    assert.match(sql, /dense_rank\(\) over\(order by member_solves\.solved_count desc\)/)
    assert.match(sql, /ranked_members\.solved_count > 0/)
  }
})
