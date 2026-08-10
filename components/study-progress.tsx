"use client"

import { useId, useRef, useState } from "react"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, ExternalLink, History, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import type { StudyHistoryPageData, StudyPeriodProblemRow } from "@/lib/study-room-data"
import { createClient } from "@/utils/supabase/client"

export type StudyProgressProfile = {
  handle: string
  nickname: string
  avatar_url: string | null
}

export type StudyProgressProblem = {
  problemId: string
  title: string
  url: string
  language: string | null
  acceptedAt: string
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

type HistoryOrder = "newest" | "oldest"

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
})

const solvedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
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

function ProblemList({ id, problems, open, loading }: { id: string; problems: StudyProgressProblem[]; open: boolean; loading: boolean }) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">
        <div className="border-t bg-muted/30 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">카운트된 문제</p>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />문제 목록을 불러오는 중...</div>
          ) : problems.length ? (
            <ul className="space-y-1.5">
              {problems.map((problem) => (
                <li key={problem.problemId}>
                  <a
                    href={problem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{problem.title || `문제 ${problem.problemId}`}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {solvedAtFormatter.format(new Date(problem.acceptedAt))}
                        {problem.language && <> · {problem.language}</>}
                      </p>
                    </div>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only">새 탭에서 문제 열기</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">이 기간에 카운트된 문제가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MemberProgressCard({
  member,
  goalCount,
  progressLabel,
  showProgress,
  open,
  problems,
  loadingProblems,
  onToggle,
}: {
  member: CurrentStudyProgressMember
  goalCount: number
  progressLabel: string
  showProgress: boolean
  open: boolean
  problems: StudyProgressProblem[]
  loadingProblems: boolean
  onToggle: () => void
}) {
  const name = displayName(member.profile)
  const percent = Math.min(100, Math.round((member.solvedCount / goalCount) * 100))
  const problemsId = useId()
  const memberSummary = (
    <>
      <div className="flex items-center gap-3">
        <UserAvatar name={name} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}{member.role === "leader" && " ♛"}</p>
          <p className="truncate text-xs text-muted-foreground">{member.profile?.handle}</p>
        </div>
        {showProgress && (
          <>
            <span className={`text-xs font-medium ${member.solvedCount >= goalCount ? "text-primary" : "text-muted-foreground"}`}>
              {member.solvedCount >= goalCount ? "달성" : `${percent}%`}
            </span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} aria-hidden="true" />
          </>
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
    </>
  )

  return (
    <Card>
      <CardContent className="p-0">
        {showProgress ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={problemsId}
            onClick={onToggle}
            className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {memberSummary}
          </button>
        ) : (
          <div className="flex flex-col gap-3 p-4">{memberSummary}</div>
        )}
        {showProgress && <ProblemList id={problemsId} problems={problems} open={open} loading={loadingProblems} />}
      </CardContent>
    </Card>
  )
}

function HistoryMemberRow({
  member,
  goalCount,
  open,
  problems,
  loadingProblems,
  onToggle,
}: {
  member: StudyProgressHistoryEntry
  goalCount: number
  open: boolean
  problems: StudyProgressProblem[]
  loadingProblems: boolean
  onToggle: () => void
}) {
  const name = displayName(member.profile)
  const percent = Math.min(100, Math.round((member.solvedCount / goalCount) * 100))
  const achieved = member.solvedCount >= goalCount
  const problemsId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={problemsId}
        onClick={onToggle}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={name} className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}{member.role === "leader" && " ♛"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{member.profile?.handle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-right">
          <div>
            <p className={`text-sm font-semibold ${achieved ? "text-primary" : ""}`}>{member.solvedCount} / {goalCount}</p>
            <p className="text-[11px] text-muted-foreground">{achieved ? "목표 달성" : `${percent}%`}</p>
          </div>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} aria-hidden="true" />
        </div>
        <Progress value={percent} className="col-span-2 h-1.5" />
      </button>
      <ProblemList id={problemsId} problems={problems} open={open} loading={loadingProblems} />
    </div>
  )
}

function HistoryCard({
  period,
  goalPeriod,
  goalCount,
  openMemberKey,
  problemsByKey,
  loadingProblemKeys,
  onToggleMember,
}: {
  period: HistoryPeriod
  goalPeriod: "daily" | "weekly"
  goalCount: number
  openMemberKey: string | null
  problemsByKey: Record<string, StudyProgressProblem[]>
  loadingProblemKeys: Record<string, boolean>
  onToggleMember: (member: StudyProgressHistoryEntry) => void
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
            const memberKey = `${period.periodStart}:${member.userId}`
            return (
              <HistoryMemberRow
                key={memberKey}
                member={member}
                goalCount={goalCount}
                open={openMemberKey === memberKey}
                problems={problemsByKey[memberKey] || []}
                loadingProblems={Boolean(loadingProblemKeys[memberKey])}
                onToggle={() => onToggleMember(member)}
              />
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function StudyProgress({
  studyId,
  goalPeriod,
  goalCount,
  currentMembers,
  currentPeriod,
  canViewProgress,
}: {
  studyId: string
  goalPeriod: "daily" | "weekly"
  goalCount: number
  currentMembers: CurrentStudyProgressMember[]
  currentPeriod: { start: string; end: string } | null
  canViewProgress: boolean
}) {
  const supabaseRef = useRef(createClient())
  const [historyOrder, setHistoryOrder] = useState<HistoryOrder>("newest")
  const [history, setHistory] = useState<StudyProgressHistoryEntry[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(0)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [openCurrentMember, setOpenCurrentMember] = useState<string | null>(null)
  const [openHistoryMember, setOpenHistoryMember] = useState<string | null>(null)
  const [problemsByKey, setProblemsByKey] = useState<Record<string, StudyProgressProblem[]>>({})
  const [loadingProblemKeys, setLoadingProblemKeys] = useState<Record<string, boolean>>({})

  async function loadHistoryPage(page: number, order: HistoryOrder) {
    setLoadingHistory(true)
    try {
      const { data, error } = await supabaseRef.current.rpc("study_goal_history_page", {
        target_study: studyId,
        page_number: page,
        page_size: 5,
        history_order: order,
      })
      if (error) throw error

      const payload = data as unknown as StudyHistoryPageData
      setHistory((payload?.entries || []).map((entry) => ({
        periodStart: entry.period_start,
        periodEnd: entry.period_end,
        periodNumber: Number(entry.period_number),
        userId: entry.user_id,
        role: entry.role,
        profile: { handle: entry.handle, nickname: entry.nickname, avatar_url: entry.avatar_url },
        solvedCount: Number(entry.solved_count),
      })))
      setHistoryPage(Number(payload?.page || page))
      setHistoryTotalPages(Number(payload?.totalPages || 0))
      setHistoryLoaded(true)
      setOpenHistoryMember(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "지난 기록을 불러오지 못했습니다.")
    } finally {
      setLoadingHistory(false)
    }
  }

  async function loadProblems(userId: string, periodStart: string, key: string) {
    if (Object.prototype.hasOwnProperty.call(problemsByKey, key) || loadingProblemKeys[key]) return
    setLoadingProblemKeys((current) => ({ ...current, [key]: true }))
    try {
      const { data, error } = await supabaseRef.current.rpc("study_member_period_solve_events", {
        target_study: studyId,
        target_user: userId,
        target_period_start: periodStart,
      })
      if (error) throw error

      const problems = ((data || []) as unknown as StudyPeriodProblemRow[]).map((problem) => ({
        problemId: problem.problem_id,
        title: problem.title,
        url: problem.url,
        language: problem.language,
        acceptedAt: problem.accepted_at,
      }))
      setProblemsByKey((current) => ({ ...current, [key]: problems }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "문제 목록을 불러오지 못했습니다.")
    } finally {
      setLoadingProblemKeys((current) => ({ ...current, [key]: false }))
    }
  }

  function toggleCurrentMember(member: CurrentStudyProgressMember) {
    if (openCurrentMember === member.userId) {
      setOpenCurrentMember(null)
      return
    }
    setOpenCurrentMember(member.userId)
    if (currentPeriod) void loadProblems(member.userId, currentPeriod.start, `${currentPeriod.start}:${member.userId}`)
  }

  function toggleHistoryMember(member: StudyProgressHistoryEntry) {
    const key = `${member.periodStart}:${member.userId}`
    if (openHistoryMember === key) {
      setOpenHistoryMember(null)
      return
    }
    setOpenHistoryMember(key)
    void loadProblems(member.userId, member.periodStart, key)
  }

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
  ).sort((first, second) => historyOrder === "newest"
    ? second.periodNumber - first.periodNumber
    : first.periodNumber - second.periodNumber)
  const currentLabel = goalPeriod === "daily" ? "오늘" : "이번 주"

  return (
    <Tabs defaultValue="current" onValueChange={(value) => {
      if (value === "history" && !historyLoaded && !loadingHistory) void loadHistoryPage(1, historyOrder)
    }}>
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
        <div className="grid items-start gap-3 sm:grid-cols-2">
          {currentMembers.map((member) => {
            const problemKey = `${currentPeriod?.start || "current"}:${member.userId}`
            return (
              <MemberProgressCard
                key={member.userId}
                member={member}
                goalCount={goalCount}
                progressLabel={`${currentLabel} 풀이`}
                showProgress={canViewProgress}
                open={openCurrentMember === member.userId}
                problems={problemsByKey[problemKey] || []}
                loadingProblems={Boolean(loadingProblemKeys[problemKey])}
                onToggle={() => toggleCurrentMember(member)}
              />
            )
          })}
        </div>
      </TabsContent>

      {canViewProgress && (
        <TabsContent value="history">
          <div className="mb-3 flex justify-end">
            <Select value={historyOrder} onValueChange={(value) => {
              const nextOrder = value as HistoryOrder
              setHistoryOrder(nextOrder)
              void loadHistoryPage(1, nextOrder)
            }}>
              <SelectTrigger size="sm" aria-label="지난 기록 정렬 순서" disabled={loadingHistory}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="newest">최신순</SelectItem>
                <SelectItem value="oldest">오래된순</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loadingHistory ? (
            <Card><CardContent className="flex min-h-48 items-center justify-center gap-2 p-6 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />지난 기록을 불러오는 중...</CardContent></Card>
          ) : historyLoaded && historyPeriods.length === 0 ? (
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
                <HistoryCard
                  key={period.periodStart}
                  period={period}
                  goalPeriod={goalPeriod}
                  goalCount={goalCount}
                  openMemberKey={openHistoryMember}
                  problemsByKey={problemsByKey}
                  loadingProblemKeys={loadingProblemKeys}
                  onToggleMember={toggleHistoryMember}
                />
              ))}
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button type="button" variant="outline" size="sm" disabled={historyPage <= 1 || loadingHistory} onClick={() => void loadHistoryPage(historyPage - 1, historyOrder)}><ChevronLeft className="size-4" />이전</Button>
                  <span className="text-xs text-muted-foreground">{historyPage} / {historyTotalPages} 페이지</span>
                  <Button type="button" variant="outline" size="sm" disabled={historyPage >= historyTotalPages || loadingHistory} onClick={() => void loadHistoryPage(historyPage + 1, historyOrder)}>다음<ChevronRight className="size-4" /></Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  )
}
