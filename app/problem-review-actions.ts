"use server"

import { revalidatePath } from "next/cache"
import { getViewer } from "@/lib/server/viewer"

export async function setProblemReview(problemId: string, needsReview: boolean) {
  if (typeof problemId !== "string" || !/^\d{1,100}$/.test(problemId) || typeof needsReview !== "boolean") {
    return { ok: false as const, message: "복습할 문제 정보가 올바르지 않습니다." }
  }

  const { supabase, user } = await getViewer()
  if (!user) return { ok: false as const, message: "로그인이 필요합니다." }

  // 복합 외래 키와 RLS가 본인의 풀이만 지정하도록 제한한다.
  const { error } = needsReview
    ? await supabase.from("problem_reviews").upsert({
      user_id: user.id,
      platform: "programmers",
      problem_id: problemId,
    }, { onConflict: "user_id,platform,problem_id", ignoreDuplicates: true })
    : await supabase.from("problem_reviews").delete()
      .eq("user_id", user.id).eq("platform", "programmers").eq("problem_id", problemId)

  if (error) {
    console.error("problem review save failed", { problemId, code: error.code })
    return { ok: false as const, message: "복습 지정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }

  revalidatePath("/")
  revalidatePath("/notes")
  return { ok: true as const, needsReview }
}
