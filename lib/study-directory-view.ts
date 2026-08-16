export type StudyDirectoryView = "all" | "joined"

export function parseStudyDirectoryView(value: unknown): StudyDirectoryView {
  return value === "all" ? "all" : "joined"
}
