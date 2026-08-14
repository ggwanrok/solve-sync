import { NextResponse } from "next/server"
import { isValidInstallationId } from "@/lib/extension-connect"
import { createRequestClient } from "@/utils/supabase/request"

async function viewer(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  return { supabase, user }
}

export async function GET(request: Request) {
  const { supabase, user } = await viewer(request)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  const { data, error } = await supabase
    .from("extension_connections")
    .select("installation_id,device_name,created_at,last_seen_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "연결 기기를 확인하지 못했습니다." }, { status: 500 })
  return NextResponse.json({ devices: data || [] })
}

export async function DELETE(request: Request) {
  const { supabase, user } = await viewer(request)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 요청이 필요합니다." }, { status: 400 })
  }
  if (!isValidInstallationId(input.installationId)) {
    return NextResponse.json({ error: "유효한 기기를 선택해 주세요." }, { status: 400 })
  }

  const { error } = await supabase
    .from("extension_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("installation_id", input.installationId)
  if (error) return NextResponse.json({ error: "기기 연결을 해제하지 못했습니다." }, { status: 500 })
  return NextResponse.json({ ok: true })
}
