import type { DifficultyLevel } from "@/lib/difficulty"

export type StudyDirectoryView = "all" | "joined"

export function parseStudyDirectoryView(value: unknown): StudyDirectoryView {
  return value === "all" ? "all" : "joined"
}

export function parseStudyMinDifficulty(value: unknown): DifficultyLevel {
  const level = typeof value === "string" && value.trim() === "" ? Number.NaN : Number(value)
  return Number.isInteger(level) && level >= 0 && level <= 5 ? level as DifficultyLevel : 0
}

export function studyDirectoryHref({
  field,
  query,
  page,
  minDifficulty,
  view,
}: {
  field?: unknown
  query?: unknown
  page?: unknown
  minDifficulty?: unknown
  view?: unknown
} = {}) {
  const normalizedQuery = typeof query === "string" ? query.trim() : ""
  const normalizedField = field === "description" || field === "owner" ? field : "title"
  const normalizedPage = typeof page === "number" ? page : Number.parseInt(String(page || "1"), 10)
  const normalizedDifficulty = parseStudyMinDifficulty(minDifficulty)
  const normalizedView = parseStudyDirectoryView(view)
  const search = new URLSearchParams()

  if (normalizedQuery) {
    search.set("field", normalizedField)
    search.set("query", normalizedQuery)
  }
  if (normalizedDifficulty > 0) search.set("minDifficulty", String(normalizedDifficulty))
  if (normalizedView === "all") search.set("view", normalizedView)
  if (Number.isInteger(normalizedPage) && normalizedPage > 1) search.set("page", String(normalizedPage))

  const queryString = search.toString()
  return queryString ? `/study?${queryString}` : "/study"
}
