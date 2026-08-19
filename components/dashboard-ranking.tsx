import { BarChart3, Crown, Sparkles, Trophy } from "lucide-react"
import { DifficultyBadge } from "@/components/difficulty-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RANKING_DIFFICULTY_POINTS, RANKING_SOLVE_BONUS_MAX, RANKING_TOP_PROBLEM_LIMIT } from "@/lib/ranking"
import { cn } from "@/lib/utils"

export type DashboardRankingEntry = {
  rankingPosition: number
  userId: string
  handle: string
  nickname: string
  avatarUrl: string | null
  rankingScore: number
  top100Score: number
  solvedBonus: number
  totalSolved: number
  levelSolved: [number, number, number, number, number, number]
  unknownSolved: number
}

export type ViewerRanking = Omit<DashboardRankingEntry, "rankingPosition"> & {
  rankingPosition: number | null
}

const rankStyle: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-600 dark:text-amber-300",
  2: "bg-slate-400/15 text-slate-600 dark:text-slate-300",
  3: "bg-orange-400/15 text-orange-700 dark:text-orange-300",
}

function formatScore(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value)
}

export function RankingSummaryCard({ ranking }: { ranking: ViewerRanking }) {
  return (
    <Card className="bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4.5 text-primary" />
          나의 랭킹
        </CardTitle>
        <CardDescription>
          가장 어려운 {RANKING_TOP_PROBLEM_LIMIT}문제와 누적 풀이 보너스를 합산해요.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-primary/8 p-4 ring-1 ring-inset ring-primary/15">
            <div className="mb-5 flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Crown className="size-4.5" />
            </div>
            <p className="text-xs text-muted-foreground">전체 순위</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {ranking.rankingPosition ? `${formatScore(ranking.rankingPosition)}위` : "집계 전"}
            </p>
          </div>
          <div className="rounded-xl bg-accent/55 p-4 ring-1 ring-inset ring-border/70">
            <div className="mb-5 flex size-9 items-center justify-center rounded-lg bg-background/70 text-accent-foreground">
              <Sparkles className="size-4.5" />
            </div>
            <p className="text-xs text-muted-foreground">랭킹 점수</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{formatScore(ranking.rankingScore)}</p>
          </div>
          <div className="col-span-2 grid grid-cols-2 divide-x rounded-xl bg-muted/45 py-3 ring-1 ring-inset ring-border/60">
            <div className="px-4">
              <p className="text-[11px] text-muted-foreground">상위 100문제</p>
              <p className="mt-0.5 font-semibold">{formatScore(ranking.top100Score)}점</p>
            </div>
            <div className="px-4">
              <p className="text-[11px] text-muted-foreground">풀이 보너스</p>
              <p className="mt-0.5 font-semibold">{formatScore(ranking.solvedBonus)} / {RANKING_SOLVE_BONUS_MAX}</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-4">
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium"><BarChart3 className="size-4 text-primary" />단계별 풀이</p>
                <p className="mt-1 text-xs text-muted-foreground">총 {formatScore(ranking.totalSolved)}문제</p>
              </div>
              {ranking.unknownSolved > 0 && <span className="text-[11px] text-muted-foreground">난이도 미확인 {ranking.unknownSolved}문제</span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ranking.levelSolved.map((count, level) => (
                <div key={level} className="flex flex-col items-center gap-2 rounded-lg bg-background/65 px-2 py-3 ring-1 ring-inset ring-border/65">
                  <DifficultyBadge level={`Lv.${level}` as `Lv.${0 | 1 | 2 | 3 | 4 | 5}`} />
                  <p className="font-semibold tabular-nums">{formatScore(count)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">문제</span></p>
                </div>
              ))}
            </div>
          </div>
          <p className="rounded-lg bg-muted/45 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
            난이도 점수는 Lv.0부터 Lv.5까지 {RANKING_DIFFICULTY_POINTS.join(" · ")}점이며, 높은 점수의 문제부터 최대 100개가 반영됩니다.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function LeaderboardCard({ entries, viewerId }: { entries: DashboardRankingEntry[]; viewerId: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="size-4.5 text-primary" />전체 랭킹</CardTitle>
        <CardDescription>랭킹 점수 상위 10명</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {entries.length ? entries.map((entry) => {
          const isViewer = entry.userId === viewerId
          return (
            <div
              key={entry.userId}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/45",
                isViewer && "bg-primary/8 ring-1 ring-inset ring-primary/15",
              )}
            >
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums", rankStyle[entry.rankingPosition] || "text-muted-foreground")}>
                {entry.rankingPosition}
              </div>
              <UserAvatar name={entry.nickname || entry.handle} imageUrl={entry.avatarUrl} className="size-8" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{entry.nickname || entry.handle}</p>
                  {isViewer && <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px]">나</Badge>}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">@{entry.handle} · {formatScore(entry.totalSolved)}문제</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{formatScore(entry.rankingScore)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">점</span></p>
            </div>
          )
        }) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg bg-muted/35 px-6 text-center">
            <Trophy className="mb-3 size-8 text-muted-foreground/55" />
            <p className="text-sm font-medium">아직 집계된 랭킹이 없습니다.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">첫 풀이가 기록되면 랭킹이 시작돼요.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
