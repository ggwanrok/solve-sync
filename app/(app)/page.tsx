import { CheckCircle2, Flame } from "lucide-react"
import { redirect } from "next/navigation"
import { LeaderboardCard, RankingSummaryCard } from "@/components/dashboard-ranking"
import { DashboardSolvesCard } from "@/components/dashboard-solves"
import { GettingStartedGuide } from "@/components/getting-started-guide"
import { Card, CardContent } from "@/components/ui/card"
import { isPodiumRank } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import { getDashboardRanking, getDashboardSolves, getDashboardSummary } from "@/lib/server/dashboard"
import { getViewer, getViewerExtensions, getViewerProfile } from "@/lib/server/viewer"

export default async function DashboardPage() {
  const { user } = await getViewer()
  if (!user) redirect("/login")
  const [extensions, profile, solvesResult, rankingResult, summary] = await Promise.all([
    getViewerExtensions(),
    getViewerProfile(),
    getDashboardSolves(),
    getDashboardRanking(),
    getDashboardSummary(),
  ])
  const viewerRanking = rankingResult.ok ? rankingResult.data.viewer : null
  const isPodium = isPodiumRank(viewerRanking?.rankingPosition)
  const stats = [
    { label: "총 푼 문제", value: summary?.totalSolved ?? "—", unit: "문제", icon: CheckCircle2, podiumIcon: "text-sky-700 dark:text-sky-300" },
    { label: "연속 스트릭", value: summary?.currentStreak ?? "—", unit: "일", icon: Flame, podiumIcon: "text-rose-600 dark:text-rose-300" },
  ]

  return (
    <div className="page-container">
      {!profile?.guide_completed_at && <GettingStartedGuide deviceConnected={(extensions?.length ?? 0) > 0} />}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => <Card key={stat.label} className="py-0"><CardContent className="flex min-h-28 items-center gap-3 p-4 sm:gap-4 sm:p-5"><div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12", isPodium ? `border border-border bg-transparent ${stat.podiumIcon}` : "bg-accent text-foreground")}><stat.icon className="size-5 sm:size-5.5" /></div><div><p className="text-xs font-medium text-muted-foreground">{stat.label}</p><p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{stat.value}<span className="ml-1 text-xs font-medium text-muted-foreground">{stat.unit}</span></p></div></CardContent></Card>)}
      </div>
      {!summary && <p role="alert" className="text-sm text-destructive">학습 통계를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
      {viewerRanking ? <RankingSummaryCard ranking={viewerRanking} /> : (
        <Card><CardContent><p className="text-sm text-muted-foreground">{rankingResult.ok ? "아직 내 랭킹이 집계되지 않았습니다." : "내 랭킹을 불러오지 못했습니다. 잠시 후 새로고침해 주세요."}</p></CardContent></Card>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <LeaderboardCard initialResult={rankingResult} viewerId={user.id} />
        <DashboardSolvesCard initialResult={solvesResult} />
      </div>
    </div>
  )
}
