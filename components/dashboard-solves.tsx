"use client"

import { ExternalLink } from "lucide-react"
import { loadDashboardSolves } from "@/app/dashboard-actions"
import { DashboardPagination } from "@/components/dashboard-pagination"
import { ProblemDifficultyBadge } from "@/components/difficulty-badge"
import { ProblemReviewButton } from "@/components/problem-review-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { APP_TIME_ZONE } from "@/lib/calendar"
import type { DashboardResult, DashboardSolvesPage } from "@/lib/dashboard"
import { useDashboardPage } from "@/lib/use-dashboard-page"
import { useProblemReview } from "@/lib/use-problem-review"

export function DashboardSolvesCard({ initialResult }: { initialResult: DashboardResult<DashboardSolvesPage> }) {
  const { data, setData, error, pending, loadPage } = useDashboardPage(initialResult, loadDashboardSolves)
  const reviews = useProblemReview((problemId, needsReview) => {
    setData((current) => current ? {
      ...current,
      entries: current.entries.map((solve) => solve.problem_id === problemId ? { ...solve, needsReview } : solve),
    } : current)
  })
  const busy = pending || reviews.pendingIds.size > 0

  return (
    <Card className="h-full min-w-0" aria-busy={busy}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>풀이 기록</CardTitle>
          <Badge variant="outline">프로그래머스</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-1.5">
          {data?.entries.map((solve) => (
            <div key={solve.id} className="flex min-w-0 items-center gap-1">
              <a href={solve.url} target="_blank" rel="noreferrer" className="block min-w-0 flex-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{solve.title || `문제 ${solve.problem_id}`}</p>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{solve.problem_type === "sql" ? "SQL" : "알고리즘"}</Badge>
                  <ProblemDifficultyBadge difficulty={solve.difficulty} />
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted-foreground">{solve.language && <>{solve.language} · </>}{new Date(solve.accepted_at).toLocaleDateString("ko-KR", { timeZone: APP_TIME_ZONE })}</p>
                <span className="sr-only">새 탭에서 문제 열기</span>
              </a>
              <ProblemReviewButton
                compact
                title={solve.title || `문제 ${solve.problem_id}`}
                needsReview={solve.needsReview}
                pending={pending || reviews.pendingIds.has(solve.problem_id)}
                onClick={() => reviews.toggle(solve.problem_id, solve.needsReview)}
              />
            </div>
          ))}
          {data && !data.entries.length && <p className="py-8 text-center text-sm text-muted-foreground">아직 수집된 풀이가 없습니다.</p>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {!data && <Button type="button" variant="outline" className="mt-3 self-center" disabled={pending} onClick={() => loadPage(1)}>다시 시도</Button>}
        {data && <DashboardPagination page={data.page} totalCount={data.totalCount} pending={busy} label="풀이 기록" onPageChange={loadPage} />}
      </CardContent>
    </Card>
  )
}
