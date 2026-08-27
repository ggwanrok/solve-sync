import { NextResponse } from "next/server"
import { disableStudyNotificationsWithoutSubscriptions } from "@/lib/server/push-delivery"
import { isAllowedPushEndpoint } from "@/lib/push-subscription"
import { isExpiredPushSubscriptionError, isWebPushConfigured, sendWebPush, type StoredPushSubscription } from "@/lib/server/web-push"
import { createAdminClient } from "@/utils/supabase/admin"
import { createRequestClient } from "@/utils/supabase/request"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "웹 푸시 서버 설정이 완료되지 않았습니다." }, { status: 503 })
  }

  let input: { endpoint?: unknown }
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "테스트할 브라우저 알림 정보가 필요합니다." }, { status: 400 })
  }

  const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : ""
  if (endpoint.length > 4096 || !isAllowedPushEndpoint(endpoint)) {
    return NextResponse.json({ error: "유효한 브라우저 알림 연결이 아닙니다." }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,expiration_time")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .maybeSingle()
  if (error) {
    console.error("push test subscription lookup failed", { userId: user.id, code: error.code, message: error.message })
    return NextResponse.json({ error: "브라우저 알림 연결을 확인하지 못했습니다." }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: "브라우저 알림을 다시 연결해 주세요." }, { status: 404 })

  try {
    await sendWebPush(data as StoredPushSubscription, {
      title: "SolveSync 알림 테스트",
      body: "이 알림이 보이면 콕 찌르기 푸시를 받을 준비가 됐어요.",
      url: "/study",
      tag: `push-test-${user.id}`,
      urgency: "high",
      ttl: 60,
    })
    return NextResponse.json({ ok: true })
  } catch (pushError) {
    if (isExpiredPushSubscriptionError(pushError)) {
      await admin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint)
      try {
        await disableStudyNotificationsWithoutSubscriptions(admin, user.id)
      } catch (cleanupError) {
        console.error("expired push test cleanup failed", {
          userId: user.id,
          error: cleanupError instanceof Error ? cleanupError.message : "unknown",
        })
      }
      return NextResponse.json({ error: "브라우저 알림 연결이 만료됐습니다. 다시 테스트해 주세요." }, { status: 410 })
    }

    console.error("push test delivery failed", {
      userId: user.id,
      error: pushError instanceof Error ? pushError.message : "unknown",
    })
    return NextResponse.json({ error: "테스트 알림을 보내지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 })
  }
}
