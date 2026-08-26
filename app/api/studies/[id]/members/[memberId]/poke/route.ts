import { NextResponse } from "next/server"
import { deliverPushToUser } from "@/lib/server/push-delivery"
import { isWebPushConfigured } from "@/lib/server/web-push"
import { createAdminClient } from "@/utils/supabase/admin"
import { createRequestClient } from "@/utils/supabase/request"

export const runtime = "nodejs"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PokeNotification = {
  id: string
  recipientId: string
  title: string
  body: string
  url: string
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params
  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(memberId)) {
    return NextResponse.json({ error: "유효한 스터디 멤버가 아닙니다." }, { status: 400 })
  }

  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  if (!isWebPushConfigured()) return NextResponse.json({ error: "웹 푸시 서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const { data, error } = await supabase.rpc("create_study_poke", {
    target_study: id,
    target_user: memberId,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const notification = data as PokeNotification
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  try {
    const delivery = await deliverPushToUser(admin, notification.recipientId, {
      title: notification.title,
      body: notification.body,
      url: notification.url,
      tag: `poke-${notification.id}`,
      urgency: "high",
    })
    if (delivery.sentCount === 0) {
      await admin.from("study_notifications").delete().eq("id", notification.id)
      return NextResponse.json({ error: "상대방에게 알림을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 })
    }

    const { error: updateError } = await admin
      .from("study_notifications")
      .update({ pushed_at: new Date().toISOString() })
      .eq("id", notification.id)
    if (updateError) console.error("study poke delivery status update failed", { notificationId: notification.id, message: updateError.message })
    return NextResponse.json({ ok: true, message: `${notification.body.replace("회원님을 ", "").replace("습니다.", "어요.")}` })
  } catch (pushError) {
    await admin.from("study_notifications").delete().eq("id", notification.id)
    console.error("study poke delivery failed", { notificationId: notification.id, error: pushError instanceof Error ? pushError.message : "unknown" })
    return NextResponse.json({ error: "콕 찌르기 알림을 보내지 못했습니다." }, { status: 500 })
  }
}
