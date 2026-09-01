import { CheckCircle2, ExternalLink, Flame } from "lucide-react"
import { redirect } from "next/navigation"
import { LeaderboardCard, RankingSummaryCard, type DashboardRankingEntry, type ViewerRanking } from "@/components/dashboard-ranking"
import { ProblemDifficultyBadge } from "@/components/difficulty-badge"
import { GettingStartedGuide } from "@/components/getting-started-guide"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { addCalendarDays, APP_TIME_ZONE, dayKey } from "@/lib/calendar"
import { combinedRankingBreakdown } from "@/lib/ranking"
import type { ProblemType } from "@/lib/problem-type"
import { cn } from "@/lib/utils"
import { getViewer, getViewerExtensions, getViewerProfile } from "@/lib/server/viewer"

type SolveEvent = { id: string; title: string; url: string; language: string | null; problem_type: ProblemType; difficulty: number | null; accepted_at: string; problem_id: string }
type RankingRpcRow = {
  ranking_position: number | string
  user_id: string
  handle: string
  nickname: string
  bio: string | null
  avatar_url: string | null
  ranking_score: number | string
  algorithm_score: number | string
  sql_score: number | string
  algorithm_solved: number | string
  sql_solved: number | string
  total_solved: number | string
  level_0_solved: number | string
  level_1_solved: number | string
  level_2_solved: number | string
  level_3_solved: number | string
  level_4_solved: number | string
  level_5_solved: number | string
  unknown_solved: number | string
}

function normalizeRankingEntry(row: RankingRpcRow): DashboardRankingEntry {
  return {
    rankingPosition: Number(row.ranking_position),
    userId: row.user_id,
    handle: row.handle,
    nickname: row.nickname,
    bio: row.bio || "",
    avatarUrl: row.avatar_url,
    rankingScore: Number(row.ranking_score),
    algorithmScore: Number(row.algorithm_score),
    sqlScore: Number(row.sql_score),
    algorithmSolved: Number(row.algorithm_solved),
    sqlSolved: Number(row.sql_solved),
    totalSolved: Number(row.total_solved),
    levelSolved: [
      Number(row.level_0_solved),
      Number(row.level_1_solved),
      Number(row.level_2_solved),
      Number(row.level_3_solved),
      Number(row.level_4_solved),
      Number(row.level_5_solved),
    ],
    unknownSolved: Number(row.unknown_solved),
  }
}

function currentStreak(events: SolveEvent[]) {
  const solvedDays = new Set(events.map((event) => dayKey(new Date(event.accepted_at))))
  const today = dayKey(new Date())
  let cursor = solvedDays.has(today) ? today : addCalendarDays(today, -1)
  let streak = 0
  while (solvedDays.has(cursor)) {
    streak += 1
    cursor = addCalendarDays(cursor, -1)
  }
  return streak
}

export default async function DashboardPage() {
  const { supabase, user } = await getViewer()
  if (!user) redirect("/login")
  const [extensions, profile, { data: solvesData }, { data: rankingData, error: rankingError }] = await Promise.all([
    getViewerExtensions(),
    getViewerProfile(),
    supabase
      .from("solve_events")
      .select("id,title,url,language,problem_type,difficulty,accepted_at,problem_id")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false }),
    supabase.rpc("dashboard_ranking", { top_limit: 10 }),
  ])
  const solves = (solvesData || []) as SolveEvent[]
  if (rankingError) console.error("dashboard ranking failed", rankingError)
  const rankingEntries = ((rankingData || []) as RankingRpcRow[]).map(normalizeRankingEntry)
  const viewerEntry = rankingEntries.find((entry) => entry.userId === user.id)
  const localRanking = combinedRankingBreakdown({
    algorithm: solves.filter((solve) => solve.problem_type === "algorithm").map((solve) => solve.difficulty),
    sql: solves.filter((solve) => solve.problem_type === "sql").map((solve) => solve.difficulty),
  })
  const viewerRanking: ViewerRanking = viewerEntry || {
    rankingPosition: null,
    userId: user.id,
    handle: profile?.handle || "",
    nickname: profile?.nickname || profile?.handle || "나",
    bio: profile?.bio || "",
    avatarUrl: profile?.avatar_url || null,
    rankingScore: localRanking.rankingScore,
    algorithmScore: localRanking.algorithmScore,
    sqlScore: localRanking.sqlScore,
    algorithmSolved: localRanking.algorithm.totalSolved,
    sqlSolved: localRanking.sql.totalSolved,
    totalSolved: localRanking.totalSolved,
    levelSolved: [
      localRanking.levelSolved[0],
      localRanking.levelSolved[1],
      localRanking.levelSolved[2],
      localRanking.levelSolved[3],
      localRanking.levelSolved[4],
      localRanking.levelSolved[5],
    ],
    unknownSolved: localRanking.unknownSolved,
  }
  const leaderboard = rankingEntries.filter((entry) => entry.rankingPosition <= 10)
  const streak = currentStreak(solves)
  const stats = [
    { label: "총 푼 문제", value: solves.length, unit: "문제", icon: CheckCircle2, accent: "text-primary" },
    { label: "연속 스트릭", value: streak, unit: "일", icon: Flame, accent: "text-warning-foreground" },
  ]

  return (
    <div className="page-container">
      {!profile?.guide_completed_at && <GettingStartedGuide deviceConnected={extensions.length > 0} />}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => <Card key={stat.label} className="py-0"><CardContent className="flex min-h-28 items-center gap-3 p-4 sm:gap-4 sm:p-5"><div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent sm:size-12", stat.accent)}><stat.icon className="size-5 sm:size-5.5" /></div><div><p className="text-xs font-medium text-muted-foreground">{stat.label}</p><p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{stat.value}<span className="ml-1 text-xs font-medium text-muted-foreground">{stat.unit}</span></p></div></CardContent></Card>)}
      </div>
      <RankingSummaryCard ranking={viewerRanking} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <LeaderboardCard entries={leaderboard} viewerId={user.id} />
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>최근 풀이</CardTitle>
                <CardDescription className="mt-1">최근 기록된 10문제</CardDescription>
              </div>
              <Badge variant="outline">{extensions.length ? "프로그래머스" : "미연동"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {solves.length ? solves.slice(0, 10).map((solve) => (
              <a
                key={solve.id}
                href={solve.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{solve.title || `문제 ${solve.problem_id}`}</p>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{solve.problem_type === "sql" ? "SQL" : "알고리즘"}</Badge>
                  <ProblemDifficultyBadge difficulty={solve.difficulty} />
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground">{solve.language && <>{solve.language} · </>}{new Date(solve.accepted_at).toLocaleDateString("ko-KR", { timeZone: APP_TIME_ZONE })}</p>
                <span className="sr-only">새 탭에서 문제 열기</span>
              </a>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">아직 수집된 풀이가 없습니다.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
