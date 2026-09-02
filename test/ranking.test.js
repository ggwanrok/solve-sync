import test from "node:test"
import assert from "node:assert/strict"

test("랭킹 풀이 보너스는 누적 풀이 수에 따라 최대 200점에 수렴한다", async () => {
  const { solveCountBonus } = await import("../lib/ranking.ts")

  assert.equal(solveCountBonus(0), 0)
  assert.equal(solveCountBonus(100), 52)
  assert.equal(solveCountBonus(10_000), 200)
})

test("랭킹 난이도 점수는 상위 레벨일수록 더 큰 폭으로 증가한다", async () => {
  const { RANKING_DIFFICULTY_POINTS } = await import("../lib/ranking.ts")

  assert.deepEqual(RANKING_DIFFICULTY_POINTS, [5, 8, 13, 21, 34, 55])
})

test("랭킹 난이도 점수는 가장 어려운 100문제만 반영한다", async () => {
  const { rankingBreakdown } = await import("../lib/ranking.ts")
  const breakdown = rankingBreakdown([...Array(101).fill(5), null])

  assert.equal(breakdown.topProblemScore, 5_500)
  assert.equal(breakdown.levelSolved[5], 101)
  assert.equal(breakdown.unknownSolved, 1)
  assert.equal(breakdown.totalSolved, 102)
  assert.equal(breakdown.rankingScore, breakdown.topProblemScore + breakdown.solveBonus)
})

test("알고리즘과 SQL 점수를 독립적으로 산출하고 SQL 점수의 절반을 반영한다", async () => {
  const { combinedRankingBreakdown } = await import("../lib/ranking.ts")
  const breakdown = combinedRankingBreakdown({
    algorithm: [5],
    sql: [0],
  })

  assert.equal(breakdown.algorithmScore, 56)
  assert.equal(breakdown.sqlScore, 6)
  assert.equal(breakdown.rankingScore, 59)
  assert.equal(breakdown.totalSolved, 2)
  assert.equal(breakdown.levelSolved[5], 1)
  assert.equal(breakdown.levelSolved[0], 1)
})

test("SQL 점수는 2로 정수 나눗셈해 소수점을 버린다", async () => {
  const { combinedRankingBreakdown } = await import("../lib/ranking.ts")
  const breakdown = combinedRankingBreakdown({ algorithm: [], sql: [1, 1] })

  assert.equal(breakdown.sqlScore, 17)
  assert.equal(breakdown.rankingScore, 8)
})

test("상위 100문제 제한은 알고리즘과 SQL에 각각 적용한다", async () => {
  const { combinedRankingBreakdown } = await import("../lib/ranking.ts")
  const breakdown = combinedRankingBreakdown({
    algorithm: Array(101).fill(5),
    sql: Array(101).fill(5),
  })

  assert.equal(breakdown.algorithm.topProblemScore, 5_500)
  assert.equal(breakdown.sql.topProblemScore, 5_500)
})
