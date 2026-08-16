import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!token) return NextResponse.json({ error: "연동 토큰이 필요합니다." }, { status: 401 })

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 })
  }

  if (!/^\d+$/.test(String(input.problemId || ""))) return NextResponse.json({ error: "유효한 문제 ID가 필요합니다." }, { status: 400 })
  if (!/^https:\/\/(school\.)?programmers\.co\.kr\//.test(String(input.url || ""))) return NextResponse.json({ error: "프로그래머스 URL만 허용됩니다." }, { status: 400 })

  const title = String(input.title || "").trim().slice(0, 200)
  const language = input.language == null ? null : String(input.language).trim().slice(0, 50)
  const difficulty = input.difficulty == null || input.difficulty === "" ? null : Number(input.difficulty)
  const durationSeconds = input.durationSeconds == null ? null : Number(input.durationSeconds)
  if (difficulty != null && (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 5)) {
    return NextResponse.json({ error: "유효한 문제 난이도가 필요합니다." }, { status: 400 })
  }
  if (durationSeconds != null && (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 31_536_000)) {
    return NextResponse.json({ error: "유효한 풀이 시간이 필요합니다." }, { status: 400 })
  }

  const now = Date.now()
  const acceptedAt = input.acceptedAt ? new Date(String(input.acceptedAt)) : new Date()
  const startedAt = input.startedAt ? new Date(String(input.startedAt)) : null
  if (Number.isNaN(acceptedAt.getTime()) || acceptedAt.getTime() > now + 5 * 60_000) {
    return NextResponse.json({ error: "유효한 정답 시각이 필요합니다." }, { status: 400 })
  }
  if (startedAt && (Number.isNaN(startedAt.getTime()) || startedAt > acceptedAt)) {
    return NextResponse.json({ error: "유효한 풀이 시작 시각이 필요합니다." }, { status: 400 })
  }

  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: connection, error: connectionError } = await supabase
    .from("extension_connections")
    .select("user_id")
    .eq("token_hash", hash(token))
    .maybeSingle()
  if (connectionError) return NextResponse.json({ error: "연동 정보를 확인하지 못했습니다." }, { status: 500 })
  if (!connection) return NextResponse.json({ error: "유효하지 않은 연동 토큰입니다." }, { status: 401 })

  const { data: event, error } = await supabase
    .from("solve_events")
    .upsert({
      user_id: connection.user_id,
      problem_id: String(input.problemId),
      title,
      url: String(input.url),
      language,
      difficulty,
      started_at: startedAt?.toISOString() || null,
      duration_seconds: durationSeconds,
      accepted_at: acceptedAt.toISOString(),
    }, { onConflict: "user_id,platform,problem_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle()
  if (error) return NextResponse.json({ error: "풀이 기록을 저장하지 못했습니다." }, { status: 500 })

  // 이전에 저장된 동일 문제도 다시 제출되면 새 메타데이터로 난이도를 보강합니다.
  if (!event && difficulty != null) {
    const { error: updateError } = await supabase
      .from("solve_events")
      .update({ difficulty })
      .eq("user_id", connection.user_id)
      .eq("platform", "programmers")
      .eq("problem_id", String(input.problemId))
    if (updateError) return NextResponse.json({ error: "문제 난이도를 저장하지 못했습니다." }, { status: 500 })
  }

  await supabase.from("extension_connections").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", hash(token))
  const duplicate = !event
  return NextResponse.json({ event: event ? { id: event.id } : null, duplicate }, { status: duplicate ? 200 : 201 })
}
