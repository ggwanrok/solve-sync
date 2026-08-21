export const RANKING_TOP_PROBLEM_LIMIT = 100
export const RANKING_SOLVE_BONUS_MAX = 200
export const RANKING_SOLVE_BONUS_DECAY = 0.997
export const RANKING_DIFFICULTY_POINTS = [5, 10, 15, 20, 25, 30] as const
export const SQL_RANKING_DIVISOR = 2

type RankingDifficultyLevel = 0 | 1 | 2 | 3 | 4 | 5

export type RankingBreakdown = {
  rankingScore: number
  topProblemScore: number
  solveBonus: number
  totalSolved: number
  levelSolved: Record<RankingDifficultyLevel, number>
  unknownSolved: number
}

export type CombinedRankingBreakdown = {
  rankingScore: number
  algorithmScore: number
  sqlScore: number
  algorithm: RankingBreakdown
  sql: RankingBreakdown
  totalSolved: number
  levelSolved: Record<RankingDifficultyLevel, number>
  unknownSolved: number
}

export function solveCountBonus(totalSolved: number) {
  const normalized = Math.max(0, Math.floor(totalSolved))
  return Math.round(RANKING_SOLVE_BONUS_MAX * (1 - RANKING_SOLVE_BONUS_DECAY ** normalized))
}

function rankingDifficultyLevel(value: unknown): RankingDifficultyLevel | null {
  if (value == null || (typeof value !== "number" && typeof value !== "string")) return null
  if (typeof value === "string" && value.trim() === "") return null
  const normalized = typeof value === "string" ? value.trim().replace(/^Lv\./, "") : value
  const level = Number(normalized)
  return Number.isInteger(level) && level >= 0 && level <= 5 ? level as RankingDifficultyLevel : null
}

export function rankingBreakdown(difficulties: readonly unknown[]): RankingBreakdown {
  const levelSolved: Record<RankingDifficultyLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const ratedPoints: number[] = []
  let unknownSolved = 0

  difficulties.forEach((difficulty) => {
    const level = rankingDifficultyLevel(difficulty)
    if (level == null) {
      unknownSolved += 1
      return
    }

    levelSolved[level] += 1
    ratedPoints.push(RANKING_DIFFICULTY_POINTS[level])
  })

  const topProblemScore = ratedPoints
    .sort((left, right) => right - left)
    .slice(0, RANKING_TOP_PROBLEM_LIMIT)
    .reduce((total, points) => total + points, 0)
  const solveBonus = solveCountBonus(difficulties.length)

  return {
    rankingScore: topProblemScore + solveBonus,
    topProblemScore,
    solveBonus,
    totalSolved: difficulties.length,
    levelSolved,
    unknownSolved,
  }
}

export function combinedRankingBreakdown(difficulties: {
  algorithm: readonly unknown[]
  sql: readonly unknown[]
}): CombinedRankingBreakdown {
  const algorithm = rankingBreakdown(difficulties.algorithm)
  const sql = rankingBreakdown(difficulties.sql)
  const levelSolved: Record<RankingDifficultyLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

  for (let level = 0; level <= 5; level += 1) {
    const normalizedLevel = level as RankingDifficultyLevel
    levelSolved[normalizedLevel] = algorithm.levelSolved[normalizedLevel] + sql.levelSolved[normalizedLevel]
  }

  return {
    rankingScore: algorithm.rankingScore + Math.floor(sql.rankingScore / SQL_RANKING_DIVISOR),
    algorithmScore: algorithm.rankingScore,
    sqlScore: sql.rankingScore,
    algorithm,
    sql,
    totalSolved: algorithm.totalSolved + sql.totalSolved,
    levelSolved,
    unknownSolved: algorithm.unknownSolved + sql.unknownSolved,
  }
}
