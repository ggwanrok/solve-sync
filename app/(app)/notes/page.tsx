import type { Metadata } from "next"
import { ProblemWorkspace } from "@/components/problem-workspace"
import { getViewerProblemNotes } from "@/lib/server/viewer"

export const metadata: Metadata = {
  title: "문제 | SolveSync",
  description: "풀이한 문제의 메모를 기록하고 북마크한 문제를 모아 복습합니다.",
}

export default async function ProblemsPage() {
  const problems = await getViewerProblemNotes()
  return <ProblemWorkspace initialProblems={problems} />
}
