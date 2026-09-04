import { getViewer } from "@/lib/server/viewer"
import { dashboardPage, type DashboardRankingEntry, type DashboardRankingPage, type DashboardResult, type DashboardSolvesPage, type DashboardSummary } from "@/lib/dashboard"

type RankingRow = {
  ranking_position: number; user_id: string; handle: string; nickname: string
  bio: string | null; avatar_url: string | null; ranking_score: number
  algorithm_score: number; sql_score: number; algorithm_solved: number; sql_solved: number
  total_solved: number; level_0_solved: number; level_1_solved: number; level_2_solved: number
  level_3_solved: number; level_4_solved: number; level_5_solved: number; unknown_solved: number
}

function rankingEntry(row: RankingRow): DashboardRankingEntry {
  return {
    rankingPosition: Number(row.ranking_position), userId: row.user_id, handle: row.handle,
    nickname: row.nickname, bio: row.bio || "", avatarUrl: row.avatar_url,
    rankingScore: Number(row.ranking_score), algorithmScore: Number(row.algorithm_score),
    sqlScore: Number(row.sql_score), algorithmSolved: Number(row.algorithm_solved),
    sqlSolved: Number(row.sql_solved), totalSolved: Number(row.total_solved),
    levelSolved: [row.level_0_solved, row.level_1_solved, row.level_2_solved, row.level_3_solved, row.level_4_solved, row.level_5_solved].map(Number) as DashboardRankingEntry["levelSolved"],
    unknownSolved: Number(row.unknown_solved),
  }
}

export async function getDashboardRanking(page = 1): Promise<DashboardResult<DashboardRankingPage>> {
  const { supabase, user } = await getViewer()
  if (!user) return { ok: false, message: "로그인이 필요합니다." }
  const { data, error } = await supabase.rpc("dashboard_ranking_page", {
    page_number: dashboardPage(page),
  })
  if (error || !data) {
    console.error("dashboard ranking page failed", error)
    return { ok: false, message: "랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }
  return { ok: true, data: {
    entries: (data.entries as RankingRow[]).map(rankingEntry),
    viewer: data.viewer ? rankingEntry(data.viewer) : null,
    page: Number(data.page), totalCount: Number(data.totalCount),
  } }
}

export async function getDashboardSolves(page = 1): Promise<DashboardResult<DashboardSolvesPage>> {
  const { supabase, user } = await getViewer()
  if (!user) return { ok: false, message: "로그인이 필요합니다." }
  const { data, error } = await supabase.rpc("dashboard_solves_page", {
    page_number: dashboardPage(page),
  })
  if (error || !data) {
    console.error("dashboard solves page failed", error)
    return { ok: false, message: "풀이 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }
  return { ok: true, data: data as DashboardSolvesPage }
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const { supabase, user } = await getViewer()
  if (!user) return null
  const { data, error } = await supabase.rpc("dashboard_solve_summary")
  if (error || !data) {
    console.error("dashboard solve summary failed", error)
    return null
  }
  return data as DashboardSummary
}
