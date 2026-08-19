import test from "node:test"
import assert from "node:assert/strict"

test("랭킹 풀이 보너스는 누적 풀이 수에 따라 최대 200점에 수렴한다", async () => {
  const { solveCountBonus } = await import("../lib/ranking.ts")

  assert.equal(solveCountBonus(0), 0)
  assert.equal(solveCountBonus(100), 52)
  assert.equal(solveCountBonus(10_000), 200)
})

test("랭킹 난이도 점수는 가장 어려운 100문제만 반영한다", async () => {
  const { rankingBreakdown } = await import("../lib/ranking.ts")
  const breakdown = rankingBreakdown([...Array(101).fill(5), null])

  assert.equal(breakdown.topProblemScore, 3_000)
  assert.equal(breakdown.levelSolved[5], 101)
  assert.equal(breakdown.unknownSolved, 1)
  assert.equal(breakdown.totalSolved, 102)
  assert.equal(breakdown.rankingScore, breakdown.topProblemScore + breakdown.solveBonus)
})
