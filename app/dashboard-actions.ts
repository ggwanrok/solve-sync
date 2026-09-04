"use server"

import { getDashboardRanking, getDashboardSolves } from "@/lib/server/dashboard"

export async function loadDashboardRanking(page: number) {
  return getDashboardRanking(page)
}

export async function loadDashboardSolves(page: number) {
  return getDashboardSolves(page)
}
