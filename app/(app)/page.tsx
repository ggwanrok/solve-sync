import { CheckCircle2, Flame } from "lucide-react"
import { redirect } from "next/navigation"
import { ContributionGraph, type ContributionDay } from "@/components/contribution-graph"
import { ExtensionStatus } from "@/components/extension-status"
import { GettingStartedGuide } from "@/components/getting-started-guide"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getViewer, getViewerExtension, getViewerProfile } from "@/lib/server/viewer"

type SolveEvent = { id: string; title: string; language: string | null; accepted_at: string; problem_id: string }
const dayKey = (date: Date) => date.toISOString().slice(0, 10)

function currentStreak(events: SolveEvent[]) {
  const solvedDays = new Set(events.map((event) => dayKey(new Date(event.accepted_at))))
  const cursor = new Date()
  if (!solvedDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (solvedDays.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1) }
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
  const contributions: ContributionDay[] = Array.from({ length: 364 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (363 - offset))
    const dateString = dayKey(date)
    return { date: dateString, problems: problemsByDay.get(dateString) || [] }
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
      <Card><CardHeader><CardTitle className="text-base">나의 잔디</CardTitle><p className="text-sm text-muted-foreground">최근 1년간 실제 수집된 풀이 수</p></CardHeader><CardContent><ContributionGraph data={contributions} /></CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">최근 풀이</CardTitle><Badge variant="outline">{extension?.last_seen_at ? "프로그래머스" : "미연동"}</Badge></CardHeader><CardContent className="flex flex-col gap-1">{solves.length ? solves.slice(0, 5).map((solve) => <div key={solve.id} className="rounded-lg px-2 py-2 hover:bg-accent/50"><p className="truncate text-sm font-medium">{solve.title || `문제 ${solve.problem_id}`}</p><p className="text-xs text-muted-foreground">{solve.language && <>{solve.language} · </>}{new Date(solve.accepted_at).toLocaleDateString("ko-KR")}</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">아직 수집된 풀이가 없습니다.</p>}</CardContent></Card>
    </div>
  )
}
