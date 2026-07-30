"use client"

import { CalendarDays, Clock, History } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"

export type StudyProgressProfile = {
  handle: string
  nickname: string
  avatar_url: string | null
}

export type CurrentStudyProgressMember = {
  userId: string
  role: string
  profile: StudyProgressProfile | null
  solvedCount: number
}

export type StudyProgressHistoryEntry = {
  periodStart: string
  periodEnd: string
  periodNumber: number
  userId: string
  role: string
  profile: StudyProgressProfile | null
  solvedCount: number
}

type HistoryPeriod = {
  periodStart: string
  periodEnd: string
  periodNumber: number
  members: StudyProgressHistoryEntry[]
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
})

function displayName(profile: StudyProgressProfile | null) {
  return profile?.nickname || profile?.handle || "멤버"
}

function periodDateLabel(period: HistoryPeriod, goalPeriod: "daily" | "weekly") {
  const start = new Date(period.periodStart)
  if (goalPeriod === "daily") return dateFormatter.format(start)

  const inclusiveEnd = new Date(new Date(period.periodEnd).getTime() - 1)
  return `${dateFormatter.format(start)} – ${dateFormatter.format(inclusiveEnd)}`
}

function MemberProgressCard({
  member,
  goalCount,
  progressLabel,
  showProgress,
}: {
  member: CurrentStudyProgressMember
  goalCount: number
  progressLabel: string
  showProgress: boolean
}) {
  const name = displayName(member.profile)
  const percent = Math.min(100, Math.round((member.solvedCount / goalCount) * 100))

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={name} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}{member.role === "leader" && " ♛"}</p>
            <p className="truncate text-xs text-muted-foreground">{member.profile?.handle}</p>
          </div>
          {showProgress && (
            <span className={`text-xs font-medium ${member.solvedCount >= goalCount ? "text-primary" : "text-muted-foreground"}`}>
              {member.solvedCount >= goalCount ? "달성" : `${percent}%`}
            </span>
          )}
        </div>
        {showProgress && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{progressLabel}</span>
              <span className="font-medium">{member.solvedCount} / {goalCount}문제</span>
            </div>
            <Progress value={percent} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HistoryCard({
  period,
  goalPeriod,
  goalCount,
}: {
  period: HistoryPeriod
  goalPeriod: "daily" | "weekly"
  goalCount: number
}) {
  const unit = goalPeriod === "daily" ? "일차" : "주차"

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
            {period.periodNumber}{unit === "일차" ? "일" : "주"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{period.periodNumber}{unit}</p>
            <p className="text-xs text-muted-foreground">{periodDateLabel(period, goalPeriod)}</p>
          </div>
          <Badge variant="secondary">{period.members.length}명</Badge>
        </div>
        <div className="divide-y">
          {period.members.map((member) => {
            const name = displayName(member.profile)
            const percent = Math.min(100, Math.round((member.solvedCount / goalCount) * 100))
            const achieved = member.solvedCount >= goalCount

            return (
              <div key={`${period.periodStart}-${member.userId}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar name={name} className="size-8" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{name}{member.role === "leader" && " ♛"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{member.profile?.handle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${achieved ? "text-primary" : ""}`}>{member.solvedCount} / {goalCount}</p>
                  <p className="text-[11px] text-muted-foreground">{achieved ? "목표 달성" : `${percent}%`}</p>
                </div>
                <Progress value={percent} className="col-span-2 h-1.5" />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function StudyProgress({
  goalPeriod,
  goalCount,
  currentMembers,
  history,
  canViewProgress,
}: {
  goalPeriod: "daily" | "weekly"
  goalCount: number
  currentMembers: CurrentStudyProgressMember[]
  history: StudyProgressHistoryEntry[]
  canViewProgress: boolean
}) {
  const historyPeriods = Array.from(
    history.reduce((periods, entry) => {
      const existing = periods.get(entry.periodStart)
      if (existing) existing.members.push(entry)
      else periods.set(entry.periodStart, {
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
        periodNumber: entry.periodNumber,
        members: [entry],
      })
      return periods
    }, new Map<string, HistoryPeriod>()),
    ([, period]) => period,
  )
  const currentLabel = goalPeriod === "daily" ? "오늘" : "이번 주"

  return (
    <Tabs defaultValue="current">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h2 className="font-semibold">멤버별 목표</h2>
          <Badge variant="secondary">{currentMembers.length}</Badge>
        </div>
        {canViewProgress && (
          <TabsList aria-label="스터디 목표 기록 선택">
            <TabsTrigger value="current"><CalendarDays data-icon="inline-start" />{currentLabel}</TabsTrigger>
            <TabsTrigger value="history"><History data-icon="inline-start" />지난 기록</TabsTrigger>
          </TabsList>
        )}
      </div>

      <TabsContent value="current">
        <div className="grid gap-3 sm:grid-cols-2">
          {currentMembers.map((member) => (
            <MemberProgressCard
              key={member.userId}
              member={member}
              goalCount={goalCount}
              progressLabel={`${currentLabel} 풀이`}
              showProgress={canViewProgress}
            />
          ))}
        </div>
      </TabsContent>

      {canViewProgress && (
        <TabsContent value="history">
          {historyPeriods.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
                <History className="mb-3 size-7 text-muted-foreground/50" />
                <p className="text-sm font-medium">아직 지난 기록이 없어요</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {goalPeriod === "daily" ? "하루가 끝나면 일별 기록이 쌓입니다." : "이번 주가 끝나면 주차별 기록이 쌓입니다."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {historyPeriods.map((period) => (
                <HistoryCard key={period.periodStart} period={period} goalPeriod={goalPeriod} goalCount={goalCount} />
              ))}
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  )
}
