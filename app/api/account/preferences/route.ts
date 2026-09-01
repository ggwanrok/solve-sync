import { NextResponse } from "next/server"
import { createRequestClient } from "@/utils/supabase/request"

export async function PATCH(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 요청이 필요합니다." }, { status: 400 })
  }

  if (typeof input.problemMemoPromptEnabled !== "boolean") {
    return NextResponse.json({ error: "문제 메모 열기 설정이 올바르지 않습니다." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ problem_memo_prompt_enabled: input.problemMemoPromptEnabled })
    .eq("id", user.id)
    .select("problem_memo_prompt_enabled")
    .single()
  if (error) {
    console.error("account preferences update failed", { userId: user.id, code: error.code, message: error.message })
    return NextResponse.json({ error: "개인 설정을 변경하지 못했습니다." }, { status: 500 })
  }

  return NextResponse.json({ problemMemoPromptEnabled: data.problem_memo_prompt_enabled })
}
