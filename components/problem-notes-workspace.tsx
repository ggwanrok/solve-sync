"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Loader2,
  NotebookPen,
  Search,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { usePendingActions } from "@/lib/use-pending-action"
import { saveProblemMemo } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProblemDifficultyBadge } from "@/components/difficulty-badge"
import { SolutionCodeEditor } from "@/components/solution-code-editor"
import {
  EMPTY_PROBLEM_MEMO,
  PROBLEM_MEMO_APPROACH_LIMIT,
  PROBLEM_MEMO_CODE_LIMIT,
  PROBLEM_MEMO_DIFFICULTY_REASON_LIMIT,
  PROBLEM_MEMO_LEARNINGS_LIMIT,
  PROBLEM_MEMO_TAGS_LIMIT,
  type ProblemMemoFields,
  type SolvedProblemNote,
} from "@/lib/problem-memo"
import { cn } from "@/lib/utils"

type MemoFilter = "all" | "written" | "empty"

const fieldDescriptions: Array<{
  key: Exclude<keyof ProblemMemoFields, "algorithmTags">
  label: string
  placeholder: string
  rows: number
  maxLength: number
  code?: boolean
}> = [
  { key: "approach", label: "접근 방법", placeholder: "문제를 보고 떠올린 핵심 아이디어와 풀이 순서를 적어보세요.", rows: 4, maxLength: PROBLEM_MEMO_APPROACH_LIMIT },
  { key: "solutionCode", label: "해결 코드", placeholder: "최종 해결 코드를 붙여 넣어보세요.", rows: 10, maxLength: PROBLEM_MEMO_CODE_LIMIT, code: true },
  { key: "difficultyReason", label: "틀리거나 시간이 오래 걸린 이유", placeholder: "막혔던 지점, 잘못 생각한 부분과 오래 걸린 이유를 적어보세요.", rows: 4, maxLength: PROBLEM_MEMO_DIFFICULTY_REASON_LIMIT },
  { key: "learnings", label: "배운 점", placeholder: "이 문제를 통해 새로 알게 된 점이나 다음에 기억할 내용을 적어보세요.", rows: 4, maxLength: PROBLEM_MEMO_LEARNINGS_LIMIT },
]

function initialDraft(problem: SolvedProblemNote): ProblemMemoFields {
  if (!problem.memo) return { ...EMPTY_PROBLEM_MEMO }
  const { updatedAt: _updatedAt, ...fields } = problem.memo
  return fields
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export function ProblemNotesWorkspace({ initialProblems }: { initialProblems: SolvedProblemNote[] }) {
  const [problems, setProblems] = useState(initialProblems)
  const [selectedId, setSelectedId] = useState(initialProblems[0]?.id || "")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<MemoFilter>("all")
  const [drafts, setDrafts] = useState<Record<string, ProblemMemoFields>>(() => Object.fromEntries(
    initialProblems.map((problem) => [problem.id, initialDraft(problem)]),
  ))
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const saves = usePendingActions()
  const draftVersions = useRef<Record<string, number>>({})
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const editorHeadingRef = useRef<HTMLHeadingElement>(null)

  const [previousProblems, setPreviousProblems] = useState(initialProblems)
  if (previousProblems !== initialProblems) {
    const currentById = new Map(problems.map((problem) => [problem.id, problem]))
    const refreshed = initialProblems.map((problem) => {
      const current = currentById.get(problem.id)
      return current?.memo && (!problem.memo || current.memo.updatedAt > problem.memo.updatedAt)
        ? { ...problem, memo: current.memo }
        : problem
    })
    setPreviousProblems(initialProblems)
    setProblems(refreshed)
    setDrafts((current) => Object.fromEntries(refreshed.map((problem) => [
      problem.id,
      (dirtyIds.has(problem.id) || saves.keys.has(problem.id)) && current[problem.id]
        ? current[problem.id]
        : initialDraft(problem),
    ])))
  }

  const selected = problems.find((problem) => problem.id === selectedId) || problems[0] || null
  const draft = selected ? drafts[selected.id] || initialDraft(selected) : null
  const writtenCount = problems.filter((problem) => problem.memo).length
  const filteredProblems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ko-KR")
    return problems.filter((problem) => {
      if (filter === "written" && !problem.memo) return false
      if (filter === "empty" && problem.memo) return false
      if (!query) return true
      return [problem.title, problem.problemId, problem.language, problem.memo?.algorithmTags]
        .some((value) => value?.toLocaleLowerCase("ko-KR").includes(query))
    })
  }, [filter, problems, search])

  function updateDraft<K extends keyof ProblemMemoFields>(key: K, value: ProblemMemoFields[K]) {
    if (!selected) return
    draftVersions.current[selected.id] = (draftVersions.current[selected.id] || 0) + 1
    setDrafts((current) => ({ ...current, [selected.id]: { ...current[selected.id], [key]: value } }))
    setDirtyIds((current) => new Set(current).add(selected.id))
  }

  function scrollToWorkspaceTop() {
    if (!window.matchMedia("(max-width: 767px)").matches) return
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    window.scrollTo({ top: 0, behavior })
  }

  function selectProblem(problemId: string) {
    setSelectedId(problemId)
    setMobileEditorOpen(true)
    window.requestAnimationFrame(() => {
      scrollToWorkspaceTop()
      window.requestAnimationFrame(() => editorHeadingRef.current?.focus({ preventScroll: true }))
    })
  }

  function showProblemList() {
    setMobileEditorOpen(false)
    window.requestAnimationFrame(scrollToWorkspaceTop)
  }

  async function save() {
    if (!selected || !draft || !saves.start(selected.id)) return
    const savedVersion = draftVersions.current[selected.id] || 0
    try {
      const result = await saveProblemMemo({ problemId: selected.problemId, ...draft })
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      const memo = { ...draft, updatedAt: result.updatedAt }
      setProblems((current) => current.map((problem) => problem.id === selected.id ? { ...problem, memo } : problem))
      const hasNewEdits = (draftVersions.current[selected.id] || 0) !== savedVersion
      setDirtyIds((current) => {
        const next = new Set(current)
        if (!hasNewEdits) next.delete(selected.id)
        return next
      })
      toast.success("문제 메모를 저장했습니다.")
    } catch {
      toast.error("메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    } finally {
      saves.finish(selected.id)
    }
  }

  if (!problems.length) {
    return (
      <div className="page-container max-w-3xl">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl"><NotebookPen className="size-6 text-primary" />문제 메모</h1>
        </header>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10"><NotebookPen className="size-7 text-primary" /></div>
            <div><p className="font-semibold">아직 기록된 풀이가 없습니다</p><p className="mt-1 text-sm text-muted-foreground">프로그래머스 연동 후 문제를 풀면 이곳에서 바로 메모할 수 있어요.</p></div>
            <Button render={<Link href="/programmers" />} nativeButton={false}>프로그래머스 연동하기</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container-wide">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl"><NotebookPen className="size-6 text-primary" />문제 메모</h1>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline">풀이 {problems.length}개</Badge>
          <Badge variant="secondary">메모 {writtenCount}개</Badge>
        </div>
      </header>

      <div className="grid min-w-0 items-start gap-5 md:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className={cn("min-w-0 md:sticky md:top-21", mobileEditorOpen && "hidden md:flex")}>
          <CardHeader className="border-b">
            <CardTitle>풀이한 문제</CardTitle>
            <CardDescription>메모할 문제를 선택하세요.</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="문제명, 알고리즘 검색" className="pl-8" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-muted/70 p-1">
              {([['all', '전체'], ['written', '작성'], ['empty', '미작성']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-lg px-2 py-2 text-xs font-semibold transition-colors", filter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-19rem)] min-h-40 overflow-auto px-2">
            {filteredProblems.length ? (
              <div className="flex flex-col gap-1">
                {filteredProblems.map((problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    onClick={() => selectProblem(problem.id)}
                    className={cn("group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-3 text-left transition-colors", selected?.id === problem.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/60")}
                  >
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", problem.memo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{problem.memo ? <Check className="size-3.5" /> : <NotebookPen className="size-3.5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{problem.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{problem.language || "언어 미확인"} · {dateLabel(problem.acceptedAt)}{dirtyIds.has(problem.id) ? " · 저장 전" : ""}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </button>
                ))}
              </div>
            ) : <p className="py-10 text-center text-xs text-muted-foreground">조건에 맞는 문제가 없습니다.</p>}
          </CardContent>
        </Card>

        {selected && draft && (
          <div className={cn("min-w-0 space-y-5 pb-20 md:pb-0", !mobileEditorOpen && "hidden md:block")}>
            <div className="sticky top-16 z-20 -mx-4 flex min-w-0 items-center gap-2 border-y bg-background/95 px-4 py-3 backdrop-blur md:hidden">
              <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={showProblemList}>
                <ArrowLeft />문제 목록
              </Button>
              <span className="min-w-0 flex-1 truncate text-right text-xs font-medium text-muted-foreground">{selected.title}</span>
              {dirtyIds.has(selected.id) && <Badge variant="secondary" className="shrink-0">저장 전</Badge>}
            </div>

            <section className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.055] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProblemDifficultyBadge difficulty={selected.difficulty} />
                    <Badge variant="outline">{selected.problemType === "sql" ? "SQL" : "알고리즘"}</Badge>
                    {selected.language && <Badge variant="outline">{selected.language}</Badge>}
                  </div>
                  <h2 ref={editorHeadingRef} tabIndex={-1} className="mt-3 text-xl font-bold tracking-tight outline-none sm:text-2xl">{selected.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{dateLabel(selected.acceptedAt)} 해결 · 문제 #{selected.problemId}</p>
                </div>
                <Button render={<a href={selected.url} target="_blank" rel="noreferrer" />} nativeButton={false} variant="outline" className="shrink-0">문제 열기 <ExternalLink /></Button>
              </div>
            </section>

            <Card>
              <CardHeader className="border-b">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" />풀이 기록</CardTitle>
                    <CardDescription className="mt-1">알고리즘 테마와 다시 풀 때 필요한 핵심만 간결하게 남겨보세요.</CardDescription>
                  </div>
                  {selected.memo && <Badge variant="outline">최근 수정 {dateLabel(selected.memo.updatedAt)}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label htmlFor="algorithm-tags" className="text-sm font-semibold">알고리즘 테마</label>
                  <div className="mt-3 space-y-2">
                    <Input id="algorithm-tags" value={draft.algorithmTags} maxLength={PROBLEM_MEMO_TAGS_LIMIT} onChange={(event) => updateDraft("algorithmTags", event.target.value)} placeholder="예: 그리디, 정렬, 투 포인터" />
                    <p className="text-xs text-muted-foreground">쉼표로 구분하면 문제 검색에도 활용할 수 있어요.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {fieldDescriptions.map((field) => (
                    <div key={field.key} className="space-y-2 border-t pt-6">
                      <div className="flex items-center justify-between gap-2">
                        <label id={`memo-${field.key}-label`} htmlFor={field.code ? undefined : `memo-${field.key}`} className="text-sm font-semibold">{field.label}</label>
                        <span className="text-[10px] text-muted-foreground">{draft[field.key].length}/{field.maxLength}</span>
                      </div>
                      {field.code ? (
                        <SolutionCodeEditor
                          id={`memo-${field.key}`}
                          value={draft[field.key]}
                          language={selected.language}
                          maxLength={field.maxLength}
                          placeholder={field.placeholder}
                          ariaLabelledBy={`memo-${field.key}-label`}
                          onChange={(value) => updateDraft(field.key, value)}
                        />
                      ) : (
                        <textarea id={`memo-${field.key}`} rows={field.rows} value={draft[field.key]} maxLength={field.maxLength} onChange={(event) => updateDraft(field.key, event.target.value)} placeholder={field.placeholder} spellCheck className="w-full resize-y rounded-xl border border-transparent bg-muted/45 px-3.5 py-3 text-sm leading-6 outline-none ring-1 ring-foreground/[0.075] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/45 dark:bg-input/30" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>한 문제당 하나의 메모가 유지되며, 다시 저장하면 기존 메모가 수정됩니다.</span></div>
                  <Button type="button" onClick={save} disabled={saves.keys.has(selected.id)} aria-busy={saves.keys.has(selected.id)} className="hidden sm:min-w-28 md:inline-flex">
                    {saves.keys.has(selected.id) ? <><Loader2 className="animate-spin" />저장 중</> : dirtyIds.has(selected.id) ? <><NotebookPen />저장</> : <><Check />저장</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
              <Button type="button" onClick={save} disabled={saves.keys.has(selected.id)} aria-busy={saves.keys.has(selected.id)} className="h-11 w-full">
                {saves.keys.has(selected.id) ? <><Loader2 className="animate-spin" />저장 중</> : dirtyIds.has(selected.id) ? <><NotebookPen />메모 저장</> : <><Check />저장</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
