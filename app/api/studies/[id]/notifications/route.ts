import { NextResponse } from "next/server"
import { createRequestClient } from "@/utils/supabase/request"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "유효한 스터디룸이 아닙니다." }, { status: 400 })

  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let input: { enabled?: unknown }
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 알림 설정이 필요합니다." }, { status: 400 })
  }
  if (typeof input.enabled !== "boolean") {
    return NextResponse.json({ error: "알림 설정을 확인해 주세요." }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("set_study_notifications", {
    target_study: id,
    enabled: input.enabled,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ enabled: Boolean(data) })
}
