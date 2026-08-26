import { NextResponse } from "next/server"
import { disableStudyNotificationsWithoutSubscriptions } from "@/lib/server/push-delivery"
import { isAllowedPushEndpoint, isPushEncryptionKey } from "@/lib/push-subscription"
import { createAdminClient } from "@/utils/supabase/admin"
import { createRequestClient } from "@/utils/supabase/request"

export const runtime = "nodejs"

type SubscriptionInput = {
  endpoint?: unknown
  expirationTime?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

export async function POST(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let input: SubscriptionInput
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 푸시 구독 정보가 필요합니다." }, { status: 400 })
  }

  const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : ""
  const p256dh = typeof input.keys?.p256dh === "string" ? input.keys.p256dh.trim() : ""
  const auth = typeof input.keys?.auth === "string" ? input.keys.auth.trim() : ""
  if (endpoint.length > 4096 || !isAllowedPushEndpoint(endpoint) || !isPushEncryptionKey(p256dh) || !isPushEncryptionKey(auth)) {
    return NextResponse.json({ error: "유효한 푸시 구독 정보가 필요합니다." }, { status: 400 })
  }

  const expirationTime = input.expirationTime == null ? null : Number(input.expirationTime)
  if (expirationTime != null && (!Number.isFinite(expirationTime) || expirationTime <= Date.now())) {
    return NextResponse.json({ error: "만료된 푸시 구독입니다." }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const { data: previousSubscription } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", endpoint)
    .maybeSingle()
  const now = new Date().toISOString()
  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    expiration_time: expirationTime == null ? null : new Date(expirationTime).toISOString(),
    user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
    updated_at: now,
  }, { onConflict: "endpoint" })
  if (error) {
    console.error("push subscription save failed", { userId: user.id, code: error.code, message: error.message })
    return NextResponse.json({ error: "브라우저 알림을 연결하지 못했습니다." }, { status: 500 })
  }

  if (previousSubscription?.user_id && previousSubscription.user_id !== user.id) {
    try {
      await disableStudyNotificationsWithoutSubscriptions(admin, previousSubscription.user_id)
    } catch (cleanupError) {
      console.error("previous push owner cleanup failed", {
        userId: previousSubscription.user_id,
        error: cleanupError instanceof Error ? cleanupError.message : "unknown",
      })
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
