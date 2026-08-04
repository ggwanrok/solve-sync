import { CheckCircle2, Flame } from "lucide-react"
import { redirect } from "next/navigation"
import { ContributionCalendarCard, type ContributionYear } from "@/components/contribution-calendar-card"
import { type ContributionDay } from "@/components/contribution-graph"
import { ExtensionStatus } from "@/components/extension-status"
import { GettingStartedGuide } from "@/components/getting-started-guide"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addCalendarDays, APP_TIME_ZONE, dayKey } from "@/lib/calendar"
import { cn } from "@/lib/utils"
import { getViewer, getViewerExtension, getViewerProfile } from "@/lib/server/viewer"

type SolveEvent = { id: string; title: string; language: string | null; accepted_at: string; problem_id: string }

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
  const [extension, profile, { data: solvesData }] = await Promise.all([
    getViewerExtension(),
    getViewerProfile(),
    supabase
      .from("solve_events")
      .select("id,title,language,accepted_at,problem_id")
      .eq("user_id", user.id)
      .order("accepted_at", { ascending: false }),
  ])
  const solves = (solvesData || []) as SolveEvent[]
  const problemsByDay = new Map<string, ContributionDay["problems"]>()
  solves.forEach((event) => {
    const date = dayKey(new Date(event.accepted_at))
    const problems = problemsByDay.get(date) || []
    problems.push({ title: event.title || `문제 ${event.problem_id}`, language: event.language })
    problemsByDay.set(date, problems)
  })
  const today = dayKey(new Date())
  const currentYear = Number(today.slice(0, 4))
  const solveYears = Array.from(problemsByDay.keys(), (date) => Number(date.slice(0, 4)))
    .filter((year) => year >= 2000 && year <= currentYear)
  const earliestYear = Math.min(currentYear, ...solveYears)
  const years = Array.from({ length: currentYear - earliestYear + 1 }, (_, index) => currentYear - index)
  const contributionsByYear: ContributionYear[] = years.map((year) => {
    const days: ContributionDay[] = []
    let date = `${year}-01-01`
    const lastDate = `${year}-12-31`

    while (date <= lastDate) {
      days.push({
        date,
        problems: problemsByDay.get(date) || [],
        isFuture: date > today,
      })
      date = addCalendarDays(date, 1)
    }

    return { year, days }
  })
  const streak = currentStreak(solves)
  const stats = [
    { label: "총 푼 문제", value: solves.length, unit: "문제", icon: CheckCircle2, accent: "text-primary" },
    { label: "연속 스트릭", value: streak, unit: "일", icon: Flame, accent: "text-warning-foreground" },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {!profile?.guide_completed_at && <GettingStartedGuide tokenIssued={Boolean(extension)} />}
      <ExtensionStatus connected={Boolean(extension?.last_seen_at)} tokenIssued={Boolean(extension)} lastSeenAt={extension?.last_seen_at || null} />
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => <Card key={stat.label}><CardContent className="flex items-center gap-3 p-4"><div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent", stat.accent)}><stat.icon className="size-5" /></div><div><p className="text-xs text-muted-foreground">{stat.label}</p><p className="text-xl font-bold">{stat.value}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{stat.unit}</span></p></div></CardContent></Card>)}
      </div>
      <ContributionCalendarCard years={contributionsByYear} initialYear={currentYear} />
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">최근 풀이</CardTitle><Badge variant="outline">{extension?.last_seen_at ? "프로그래머스" : "미연동"}</Badge></CardHeader><CardContent className="flex flex-col gap-1">{solves.length ? solves.slice(0, 5).map((solve) => <div key={solve.id} className="rounded-lg px-2 py-2 hover:bg-accent/50"><p className="truncate text-sm font-medium">{solve.title || `문제 ${solve.problem_id}`}</p><p className="text-xs text-muted-foreground">{solve.language && <>{solve.language} · </>}{new Date(solve.accepted_at).toLocaleDateString("ko-KR", { timeZone: APP_TIME_ZONE })}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">아직 수집된 풀이가 없습니다.</p>}</CardContent></Card>
    </div>
  )
}
