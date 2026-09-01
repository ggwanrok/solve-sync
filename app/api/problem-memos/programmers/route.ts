import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { normalizeProblemMemoInput, type ProblemMemoInput } from "@/lib/problem-memo"
import { createAdminClient } from "@/utils/supabase/admin"

export const runtime = "nodejs"

const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

function tokenFrom(request: Request) {
  const authorization = request.headers.get("authorization") || ""
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
}

export async function POST(request: Request) {
  const token = tokenFrom(request)
  if (!token) return NextResponse.json({ error: "연동 토큰이 필요합니다." }, { status: 401 })

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 })
  }

  const normalized = normalizeProblemMemoInput(input as ProblemMemoInput)
  if (!normalized) return NextResponse.json({ error: "저장할 문제 메모가 올바르지 않습니다." }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const { data: connection, error: connectionError } = await admin
    .from("extension_connections")
    .select("user_id")
    .eq("token_hash", hash(token))
    .maybeSingle()
  if (connectionError) return NextResponse.json({ error: "연동 정보를 확인하지 못했습니다." }, { status: 500 })
  if (!connection) return NextResponse.json({ error: "유효하지 않은 연동 토큰입니다." }, { status: 401 })

  const { data: solve, error: solveError } = await admin
    .from("solve_events")
    .select("problem_id")
    .eq("user_id", connection.user_id)
    .eq("platform", "programmers")
    .eq("problem_id", normalized.problemId)
    .maybeSingle()
  if (solveError) return NextResponse.json({ error: "풀이 기록을 확인하지 못했습니다." }, { status: 500 })
  if (!solve) return NextResponse.json({ error: "내가 풀이한 문제에서만 메모를 작성할 수 있습니다." }, { status: 403 })

  const updatedAt = new Date().toISOString()
  const { error } = await admin.from("problem_memos").upsert({
    user_id: connection.user_id,
    platform: "programmers",
    problem_id: normalized.problemId,
    algorithm_tags: normalized.algorithmTags,
    approach: normalized.approach,
    solution_code: normalized.solutionCode,
    difficulty_reason: normalized.difficultyReason,
    learnings: normalized.learnings,
    updated_at: updatedAt,
  }, { onConflict: "user_id,platform,problem_id" })
  if (error) {
    console.error("extension problem memo save failed", {
      userId: connection.user_id,
      problemId: normalized.problemId,
      code: error.code,
      message: error.message,
    })
    return NextResponse.json({ error: "문제 메모를 저장하지 못했습니다." }, { status: 500 })
  }

  await admin.from("extension_connections").update({ last_seen_at: updatedAt }).eq("token_hash", hash(token))
  return NextResponse.json({ ok: true, updatedAt })
}
