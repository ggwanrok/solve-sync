import { NextResponse } from "next/server"
import { createRequestClient } from "@/utils/supabase/request"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let input: { id?: unknown }
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 알림 정보가 필요합니다." }, { status: 400 })
  }
  if (input.id !== undefined && (typeof input.id !== "string" || !UUID_PATTERN.test(input.id))) {
    return NextResponse.json({ error: "유효한 알림이 아닙니다." }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("mark_study_notifications_read", {
    target_notification: input.id || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ updated: Number(data) || 0 })
}
