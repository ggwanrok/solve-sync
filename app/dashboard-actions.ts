"use server"

import { getDashboardRanking, getDashboardSolves } from "@/lib/server/dashboard"
import type { DashboardRankingType } from "@/lib/dashboard"

export async function loadDashboardRanking(page: number, rankingType: DashboardRankingType = "algorithm") {
  return getDashboardRanking(page, rankingType)
}

export async function loadDashboardSolves(page: number) {
  return getDashboardSolves(page)
}
