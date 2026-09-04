export const PROBLEM_MEMO_TAGS_LIMIT = 300
export const PROBLEM_MEMO_APPROACH_LIMIT = 500
export const PROBLEM_MEMO_CODE_LIMIT = 10_000
export const PROBLEM_MEMO_DIFFICULTY_REASON_LIMIT = 500
export const PROBLEM_MEMO_LEARNINGS_LIMIT = 300

export type ProblemMemoFields = {
  algorithmTags: string
  approach: string
  solutionCode: string
  difficultyReason: string
  learnings: string
}

export type ProblemMemoInput = ProblemMemoFields & {
  problemId: string
}

export type ProblemMemoRecord = ProblemMemoFields & {
  updatedAt: string
}

export type SolvedProblemNote = {
  id: string
  problemId: string
  title: string
  url: string
  language: string | null
  problemType: "algorithm" | "sql"
  difficulty: number | null
  acceptedAt: string
  needsReview: boolean
  memo: ProblemMemoRecord | null
}

export type MemoFilter = "all" | "written" | "empty"

export function filterProblemNotes(problems: SolvedProblemNote[], filter: MemoFilter, search: string) {
  const query = search.trim().toLocaleLowerCase("ko-KR")
  // 북마크+메모 → 북마크 → 메모 → 일반 문제. 같은 그룹은 입력된 최신순을 유지한다.
  return problems.filter((problem) => {
    if (filter === "written" && !problem.memo) return false
    if (filter === "empty" && problem.memo) return false
    return !query || [problem.title, problem.problemId, problem.language, problem.memo?.algorithmTags]
      .some((value) => value?.toLocaleLowerCase("ko-KR").includes(query))
  }).sort((left, right) =>
    Number(right.needsReview) - Number(left.needsReview)
    || Number(Boolean(right.memo)) - Number(Boolean(left.memo)),
  )
}

export function filterBookmarkedProblems(problems: SolvedProblemNote[], search: string) {
  return filterProblemNotes(problems.filter((problem) => problem.needsReview), "all", search)
}

export const EMPTY_PROBLEM_MEMO: ProblemMemoFields = {
  algorithmTags: "",
  approach: "",
  solutionCode: "",
  difficultyReason: "",
  learnings: "",
}

function normalizedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

export function normalizeProblemMemoInput(input: ProblemMemoInput): ProblemMemoInput | null {
  const problemId = normalizedText(input.problemId, 100)
  if (!/^\d+$/.test(problemId)) return null

  return {
    problemId,
    algorithmTags: normalizedText(input.algorithmTags, PROBLEM_MEMO_TAGS_LIMIT),
    approach: normalizedText(input.approach, PROBLEM_MEMO_APPROACH_LIMIT),
    solutionCode: normalizedText(input.solutionCode, PROBLEM_MEMO_CODE_LIMIT),
    difficultyReason: normalizedText(input.difficultyReason, PROBLEM_MEMO_DIFFICULTY_REASON_LIMIT),
    learnings: normalizedText(input.learnings, PROBLEM_MEMO_LEARNINGS_LIMIT),
  }
}
