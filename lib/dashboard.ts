export type DashboardRankingEntry = {
  rankingPosition: number
  userId: string
  handle: string
  nickname: string
  bio: string
  avatarUrl: string | null
  rankingScore: number
  algorithmScore: number
  sqlScore: number
  algorithmSolved: number
  sqlSolved: number
  totalSolved: number
  levelSolved: [number, number, number, number, number, number]
  unknownSolved: number
}

export type ViewerRanking = Omit<DashboardRankingEntry, "rankingPosition"> & {
  rankingPosition: number | null
}

export const DASHBOARD_PAGE_SIZE = 10
export type DashboardSolve = {
  id: string
  problem_id: string
  title: string
  url: string
  language: string | null
  problem_type: "algorithm" | "sql"
  difficulty: number | null
  accepted_at: string
  needsReview: boolean
}
export type DashboardSolvesPage = {
  entries: DashboardSolve[]
  page: number
  totalCount: number
}
export type DashboardRankingPage = {
  entries: DashboardRankingEntry[]
  viewer: DashboardRankingEntry | null
  page: number
  totalCount: number
}
export type DashboardSummary = { totalSolved: number; currentStreak: number }
export type DashboardResult<T> = { ok: true; data: T } | { ok: false; message: string }

export function dashboardPage(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? Math.min(value, 2147483647)
    : 1
}
