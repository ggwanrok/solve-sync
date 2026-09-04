"use client"

import { useMemo, useState } from "react"
import { Bookmark, ExternalLink, NotebookPen, Search } from "lucide-react"
import { ProblemDifficultyBadge } from "@/components/difficulty-badge"
import { ProblemReviewButton } from "@/components/problem-review-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { APP_TIME_ZONE } from "@/lib/calendar"
import { filterBookmarkedProblems, type SolvedProblemNote } from "@/lib/problem-memo"

export function ProblemBookmarks({ problems, pendingIds, onToggle, onOpenMemo }: {
  problems: SolvedProblemNote[]
  pendingIds: ReadonlySet<string>
  onToggle: (problemId: string, needsReview: boolean) => void
  onOpenMemo: (problemId: string) => void
}) {
  const [search, setSearch] = useState("")
  const bookmarks = useMemo(() => filterBookmarkedProblems(problems, search), [problems, search])

  return (
    <Card>
      <CardHeader>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="북마크 검색" placeholder="문제명, 알고리즘 검색" className="pl-8" />
        </div>
      </CardHeader>
      <CardContent>
        {bookmarks.length ? (
          <ul className="divide-y divide-border/60">
            {bookmarks.map((problem) => (
              <li key={problem.id} className="flex min-w-0 items-center gap-2 py-3 first:pt-0 last:pb-0 sm:gap-3">
                <ProblemReviewButton compact title={problem.title} needsReview={problem.needsReview} pending={pendingIds.has(problem.problemId)} onClick={() => onToggle(problem.problemId, problem.needsReview)} />
                <a href={problem.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 rounded-lg py-1 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{problem.title}</span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ProblemDifficultyBadge difficulty={problem.difficulty} />
                    <Badge variant="outline">{problem.problemType === "sql" ? "SQL" : "알고리즘"}</Badge>
                    <span className="text-xs text-muted-foreground">{problem.language && `${problem.language} · `}{new Date(problem.acceptedAt).toLocaleDateString("ko-KR", { timeZone: APP_TIME_ZONE })}</span>
                  </span>
                  <span className="sr-only">새 탭에서 문제 열기</span>
                </a>
                <Button type="button" variant="ghost" size="sm" aria-label={`${problem.title}: 문제 메모 열기`} onClick={() => onOpenMemo(problem.id)}>
                  <NotebookPen />메모
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Bookmark className="size-8" />
            <p className="text-sm">{search.trim() ? "검색 결과가 없습니다." : "아직 북마크한 문제가 없습니다."}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
