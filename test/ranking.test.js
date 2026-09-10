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

test("유형별 랭킹은 같은 산식의 점수를 축소 없이 사용한다", async () => {
  const { rankingBreakdown } = await import("../lib/ranking.ts")

  assert.equal(rankingBreakdown([5]).rankingScore, 56)
  assert.equal(rankingBreakdown([0]).rankingScore, 6)
  assert.equal(rankingBreakdown([1, 1]).rankingScore, 17)
  assert.equal(rankingBreakdown([]).rankingScore, 0)
})
