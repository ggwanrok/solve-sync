export const PROBLEM_MEMO_TEXT_LIMIT = 2_000
export const PROBLEM_MEMO_TAGS_LIMIT = 300

export const PERCEIVED_DIFFICULTIES = [
  { value: 1, label: "아주 쉬움" },
  { value: 2, label: "쉬움" },
  { value: 3, label: "보통" },
  { value: 4, label: "어려움" },
  { value: 5, label: "매우 어려움" },
] as const

export type PerceivedDifficulty = (typeof PERCEIVED_DIFFICULTIES)[number]["value"]

export type ProblemMemoFields = {
  perceivedDifficulty: PerceivedDifficulty | null
  algorithmTags: string
  coreCondition: string
  solutionApproach: string
  quickApproach: string
  tips: string
  mistakeNotes: string
  similarProblems: string
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
  memo: ProblemMemoRecord | null
}

export const EMPTY_PROBLEM_MEMO: ProblemMemoFields = {
  perceivedDifficulty: null,
  algorithmTags: "",
  coreCondition: "",
  solutionApproach: "",
  quickApproach: "",
  tips: "",
  mistakeNotes: "",
  similarProblems: "",
}

function normalizedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maxLength)
}

export function normalizeProblemMemoInput(input: ProblemMemoInput): ProblemMemoInput | null {
  const problemId = normalizedText(input.problemId, 100)
  if (!/^\d+$/.test(problemId)) return null

  const difficulty = Number(input.perceivedDifficulty)
  const perceivedDifficulty = Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5
    ? difficulty as PerceivedDifficulty
    : null

  return {
    problemId,
    perceivedDifficulty,
    algorithmTags: normalizedText(input.algorithmTags, PROBLEM_MEMO_TAGS_LIMIT),
    coreCondition: normalizedText(input.coreCondition, PROBLEM_MEMO_TEXT_LIMIT),
    solutionApproach: normalizedText(input.solutionApproach, PROBLEM_MEMO_TEXT_LIMIT),
    quickApproach: normalizedText(input.quickApproach, PROBLEM_MEMO_TEXT_LIMIT),
    tips: normalizedText(input.tips, PROBLEM_MEMO_TEXT_LIMIT),
    mistakeNotes: normalizedText(input.mistakeNotes, PROBLEM_MEMO_TEXT_LIMIT),
    similarProblems: normalizedText(input.similarProblems, PROBLEM_MEMO_TEXT_LIMIT),
  }
}

export function perceivedDifficultyLabel(value: number | null) {
  return PERCEIVED_DIFFICULTIES.find((item) => item.value === value)?.label || null
}
