"use client"

import { toast } from "sonner"
import { setProblemReview } from "@/app/problem-review-actions"
import { usePendingActions } from "@/lib/use-pending-action"

export function useProblemReview(onSaved: (problemId: string, needsReview: boolean) => void) {
  const pending = usePendingActions()

  async function toggle(problemId: string, needsReview: boolean) {
    if (!pending.start(problemId)) return
    try {
      const result = await setProblemReview(problemId, !needsReview)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      onSaved(problemId, result.needsReview)
      toast.success(result.needsReview ? "다시 풀 문제로 지정했습니다." : "다시 풀 문제 지정을 해제했습니다.")
    } catch {
      toast.error("복습 지정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    } finally {
      pending.finish(problemId)
    }
  }

  return { pendingIds: pending.keys, toggle }
}
