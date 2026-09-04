"use client"

import { ExternalLink } from "lucide-react"
import { loadDashboardSolves } from "@/app/dashboard-actions"
import { DashboardPagination } from "@/components/dashboard-pagination"
import { ProblemDifficultyBadge } from "@/components/difficulty-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { APP_TIME_ZONE } from "@/lib/calendar"
import type { DashboardResult, DashboardSolvesPage } from "@/lib/dashboard"
import { useDashboardPage } from "@/lib/use-dashboard-page"

export function DashboardSolvesCard({ initialResult }: { initialResult: DashboardResult<DashboardSolvesPage> }) {
  const { data, error, pending, loadPage } = useDashboardPage(initialResult, loadDashboardSolves)

  return (
    <Card className="h-full min-w-0" aria-busy={pending}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>풀이 기록</CardTitle>
            <CardDescription className="mt-1">{data ? `총 ${data.totalCount.toLocaleString("ko-KR")}문제 · 최신순으로 10개씩` : "최신순으로 10개씩"}</CardDescription>
          </div>
          <Badge variant="outline">프로그래머스</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-1.5">
          {data?.entries.map((solve) => (
            <a key={solve.id} href={solve.url} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{solve.title || `문제 ${solve.problem_id}`}</p>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{solve.problem_type === "sql" ? "SQL" : "알고리즘"}</Badge>
                <ProblemDifficultyBadge difficulty={solve.difficulty} />
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-xs text-muted-foreground">{solve.language && <>{solve.language} · </>}{new Date(solve.accepted_at).toLocaleDateString("ko-KR", { timeZone: APP_TIME_ZONE })}</p>
              <span className="sr-only">새 탭에서 문제 열기</span>
            </a>
          ))}
          {data && !data.entries.length && <p className="py-8 text-center text-sm text-muted-foreground">아직 수집된 풀이가 없습니다.</p>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        {!data && <Button type="button" variant="outline" className="mt-3 self-center" disabled={pending} onClick={() => loadPage(1)}>다시 시도</Button>}
        {data && <DashboardPagination page={data.page} totalCount={data.totalCount} pending={pending} label="풀이 기록" onPageChange={loadPage} />}
      </CardContent>
    </Card>
  )
}
