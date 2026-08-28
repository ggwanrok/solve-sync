import { BarChart3, Crown, Gauge, Trophy } from "lucide-react"
import { DifficultyBadge } from "@/components/difficulty-badge"
import { RankingFormulaHelp } from "@/components/ranking-formula-help"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

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

const rankStyle: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-600 dark:text-amber-300",
  2: "bg-slate-400/15 text-slate-600 dark:text-slate-300",
  3: "bg-orange-400/15 text-orange-700 dark:text-orange-300",
}

const donutStroke = [
  "var(--difficulty-0)",
  "var(--difficulty-1)",
  "var(--difficulty-2)",
  "var(--difficulty-3)",
  "var(--difficulty-4)",
  "var(--difficulty-5)",
] as const

function formatScore(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value)
}

function DifficultyDonutChart({ counts }: { counts: ViewerRanking["levelSolved"] }) {
  const total = counts.reduce((sum, count) => sum + count, 0)
  let offset = 0

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="relative mx-auto size-36">
        <svg
          viewBox="0 0 120 120"
          className="size-full"
          role="img"
          aria-label={`단계별 풀이 분포, 총 ${total}문제`}
        >
          <title>단계별 풀이 분포</title>
          <desc>Lv.0부터 Lv.5까지 해결한 문제 수의 비율</desc>
          <circle cx="60" cy="60" r="44" fill="none" stroke="var(--muted)" strokeWidth="14" />
          {total > 0 && counts.map((count, level) => {
            const percentage = count / total * 100
            const dashOffset = -offset
            offset += percentage
            if (!count) return null

            return (
              <circle
                key={level}
                cx="60"
                cy="60"
                r="44"
                pathLength="100"
                fill="none"
                stroke={donutStroke[level]}
                strokeWidth="14"
                strokeDasharray={`${percentage} ${100 - percentage}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 60 60)"
              />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold tabular-nums">{formatScore(total)}</p>
          <p className="text-[11px] text-muted-foreground">문제</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {counts.map((count, level) => (
          <div key={level} className="flex items-center justify-between gap-2">
            <DifficultyBadge level={`Lv.${level}` as `Lv.${0 | 1 | 2 | 3 | 4 | 5}`} />
            <p className="font-semibold tabular-nums">{formatScore(count)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">문제</span></p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RankingSummaryCard({ ranking }: { ranking: ViewerRanking }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4.5 text-primary" />
          나의 랭킹
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <span>풀이 기록을 바탕으로 계산한 SolveSync 랭킹이에요.</span>
          <RankingFormulaHelp />
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-7 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid self-center grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="flex min-h-28 items-center gap-3 rounded-2xl bg-primary/[0.075] p-4 sm:gap-4 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Crown className="size-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">전체 순위</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {ranking.rankingPosition ? `${formatScore(ranking.rankingPosition)}위` : "집계 전"}
              </p>
            </div>
          </div>
          <div className="flex min-h-28 items-center gap-3 rounded-2xl bg-muted/75 p-4 sm:gap-4 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-accent-foreground shadow-sm">
              <Gauge className="size-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">랭킹 점수</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{formatScore(ranking.rankingScore)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                알고리즘 {formatScore(ranking.algorithmScore)} + SQL {formatScore(ranking.sqlScore)} ÷ 2
              </p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium"><BarChart3 className="size-4 text-primary" />단계별 풀이</p>
              <p className="mt-1 text-xs text-muted-foreground">알고리즘 {formatScore(ranking.algorithmSolved)}문제 · SQL {formatScore(ranking.sqlSolved)}문제</p>
            </div>
            {ranking.unknownSolved > 0 && <span className="text-[11px] text-muted-foreground">난이도 미확인 {ranking.unknownSolved}문제</span>}
          </div>
          <DifficultyDonutChart counts={ranking.levelSolved} />
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/65",
                isViewer && "bg-primary/[0.075]",
              )}
            >
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums", rankStyle[entry.rankingPosition] || "text-muted-foreground")}>
                {entry.rankingPosition}
              </div>
              <UserAvatar name={entry.nickname || entry.handle} imageUrl={entry.avatarUrl} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{entry.nickname || entry.handle}</p>
                  {isViewer && <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[9px]">나</Badge>}
                </div>
                {entry.bio && <p className="truncate text-[11px] text-muted-foreground">{entry.bio}</p>}
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">{formatScore(entry.rankingScore)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">점</span></p>
            </div>
          )
        }) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-muted/45 px-6 text-center">
            <Trophy className="mb-3 size-8 text-muted-foreground/55" />
            <p className="text-sm font-medium">아직 집계된 랭킹이 없습니다.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">첫 풀이가 기록되면 랭킹이 시작돼요.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
