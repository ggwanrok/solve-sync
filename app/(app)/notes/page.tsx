import type { Metadata } from "next"
import { ProblemNotesWorkspace } from "@/components/problem-notes-workspace"
import { getViewerProblemNotes } from "@/lib/server/viewer"

export const metadata: Metadata = {
  title: "문제 메모 | SolveSync",
  description: "내가 풀이한 문제의 알고리즘 테마, 접근 방법과 배운 점을 기록하고 복습합니다.",
}

export default async function ProblemNotesPage() {
  const problems = await getViewerProblemNotes()
  return <ProblemNotesWorkspace initialProblems={problems} />
}
