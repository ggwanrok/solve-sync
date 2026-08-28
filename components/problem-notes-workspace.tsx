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
import { saveProblemMemo } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProblemDifficultyBadge } from "@/components/difficulty-badge"
import {
  EMPTY_PROBLEM_MEMO,
  PERCEIVED_DIFFICULTIES,
  PROBLEM_MEMO_TAGS_LIMIT,
  PROBLEM_MEMO_TEXT_LIMIT,
  perceivedDifficultyLabel,
  type ProblemMemoFields,
  type SolvedProblemNote,
} from "@/lib/problem-memo"
import { cn } from "@/lib/utils"

type MemoFilter = "all" | "written" | "empty"

const fieldDescriptions: Array<{
  key: Exclude<keyof ProblemMemoFields, "perceivedDifficulty" | "algorithmTags">
  label: string
  placeholder: string
  rows: number
}> = [
  { key: "coreCondition", label: "핵심 조건", placeholder: "정답을 결정하는 제약과 반드시 확인할 조건을 적어보세요.", rows: 3 },
  { key: "solutionApproach", label: "논리 구조", placeholder: "어떤 순서와 근거로 풀이했는지 적어보세요.", rows: 4 },
  { key: "quickApproach", label: "빠른 접근 방법", placeholder: "다시 풀 때 가장 먼저 확인할 단서나 접근 순서를 적어보세요.", rows: 3 },
  { key: "tips", label: "풀이 꿀팁", placeholder: "시간을 줄여준 구현 방식이나 기억할 팁을 적어보세요.", rows: 3 },
  { key: "mistakeNotes", label: "착각하기 쉬운 부분", placeholder: "틀렸거나 헷갈렸던 지점과 다음에 확인할 내용을 적어보세요.", rows: 3 },
  { key: "similarProblems", label: "비슷한 문제", placeholder: "공통 풀이 패턴이 있는 문제 이름이나 링크를 적어보세요.", rows: 2 },
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
  const [savingId, setSavingId] = useState<string | null>(null)
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const editorHeadingRef = useRef<HTMLHeadingElement>(null)

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
    if (!selected || !draft) return
    setSavingId(selected.id)
    try {
      const result = await saveProblemMemo({ problemId: selected.problemId, ...draft })
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      const memo = { ...draft, updatedAt: result.updatedAt }
      setProblems((current) => current.map((problem) => problem.id === selected.id ? { ...problem, memo } : problem))
      setDirtyIds((current) => {
        const next = new Set(current)
        next.delete(selected.id)
        return next
      })
      toast.success("문제 메모를 저장했습니다.")
    } catch {
      toast.error("메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    } finally {
      setSavingId(null)
    }
  }

  if (!problems.length) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
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
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
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
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-muted/55 p-1">
              {([['all', '전체'], ['written', '작성'], ['empty', '미작성']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-md px-2 py-1.5 text-xs font-medium transition-colors", filter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
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
                    className={cn("group flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors", selected?.id === problem.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/60")}
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

            <section className="rounded-xl border bg-card p-5 sm:p-6">
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
                    <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" />풀이 회고</CardTitle>
                    <CardDescription className="mt-1">모든 항목을 채울 필요는 없어요. 다시 봤을 때 필요한 내용만 남겨보세요.</CardDescription>
                  </div>
                  {selected.memo && <Badge variant="outline">최근 수정 {dateLabel(selected.memo.updatedAt)}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">체감 난이도</label>
                  <div className="flex flex-wrap gap-2">
                    {PERCEIVED_DIFFICULTIES.map((item) => (
                      <button key={item.value} type="button" aria-pressed={draft.perceivedDifficulty === item.value} onClick={() => updateDraft("perceivedDifficulty", draft.perceivedDifficulty === item.value ? null : item.value)} className={cn("rounded-lg border px-3 py-2 text-xs font-medium transition-colors", draft.perceivedDifficulty === item.value ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground")}>{item.label}</button>
                    ))}
                  </div>
                  {draft.perceivedDifficulty && <p className="text-xs text-muted-foreground">현재 선택: {perceivedDifficultyLabel(draft.perceivedDifficulty)}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="algorithm-tags" className="text-sm font-medium">알고리즘·문제 유형</label>
                  <Input id="algorithm-tags" value={draft.algorithmTags} maxLength={PROBLEM_MEMO_TAGS_LIMIT} onChange={(event) => updateDraft("algorithmTags", event.target.value)} placeholder="예: 그리디, 정렬, 투 포인터" />
                  <p className="text-xs text-muted-foreground">쉼표로 구분하면 목록 검색에도 활용할 수 있어요.</p>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  {fieldDescriptions.map((field) => (
                    <div key={field.key} className={cn("space-y-2", field.key === "solutionApproach" && "xl:col-span-2")}>
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`memo-${field.key}`} className="text-sm font-medium">{field.label}</label>
                        <span className="text-[10px] text-muted-foreground">{draft[field.key].length}/{PROBLEM_MEMO_TEXT_LIMIT}</span>
                      </div>
                      <textarea id={`memo-${field.key}`} rows={field.rows} value={draft[field.key]} maxLength={PROBLEM_MEMO_TEXT_LIMIT} onChange={(event) => updateDraft(field.key, event.target.value)} placeholder={field.placeholder} className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>한 문제당 하나의 메모가 유지되며, 다시 저장하면 기존 메모가 수정됩니다.</span></div>
                  <Button type="button" onClick={save} disabled={savingId === selected.id} className="hidden sm:min-w-28 md:inline-flex">
                    {savingId === selected.id ? <><Loader2 className="animate-spin" />저장 중</> : dirtyIds.has(selected.id) ? <><NotebookPen />저장</> : <><Check />저장</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
              <Button type="button" onClick={save} disabled={savingId === selected.id} className="h-11 w-full">
                {savingId === selected.id ? <><Loader2 className="animate-spin" />저장 중</> : dirtyIds.has(selected.id) ? <><NotebookPen />메모 저장</> : <><Check />저장</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
