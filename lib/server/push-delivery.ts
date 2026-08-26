import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isExpiredPushSubscriptionError,
  sendWebPush,
  type StoredPushSubscription,
  type WebPushPayload,
} from "@/lib/server/web-push"

export type PushDeliveryResult = {
  subscriptionCount: number
  sentCount: number
  failedCount: number
}

export async function disableStudyNotificationsWithoutSubscriptions(admin: SupabaseClient, userId: string) {
  const { count, error } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (error) throw new Error(`푸시 구독 상태를 확인하지 못했습니다: ${error.message}`)
  if ((count || 0) > 0) return

  const { error: updateError } = await admin
    .from("study_members")
    .update({ notifications_enabled: false })
    .eq("user_id", userId)
  if (updateError) throw new Error(`스터디 알림 설정을 정리하지 못했습니다: ${updateError.message}`)
}

export async function deliverPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: WebPushPayload,
): Promise<PushDeliveryResult> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,expiration_time")
    .eq("user_id", userId)
  if (error) throw new Error(`푸시 구독을 조회하지 못했습니다: ${error.message}`)

  const subscriptions = (data || []) as StoredPushSubscription[]
  const expiredEndpoints: string[] = []
  let sentCount = 0

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await sendWebPush(subscription, payload)
      sentCount += 1
    } catch (pushError) {
      if (isExpiredPushSubscriptionError(pushError)) expiredEndpoints.push(subscription.endpoint)
      else console.error("web push delivery failed", { userId, error: pushError instanceof Error ? pushError.message : "unknown" })
    }
  }))

  if (expiredEndpoints.length > 0) {
    const { error: deleteError } = await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints)
    if (deleteError) console.error("expired push subscription cleanup failed", { userId, message: deleteError.message })
    else {
      try {
        await disableStudyNotificationsWithoutSubscriptions(admin, userId)
      } catch (cleanupError) {
        console.error("stale study notification setting cleanup failed", {
          userId,
          error: cleanupError instanceof Error ? cleanupError.message : "unknown",
        })
      }
    }
  }

  return {
    subscriptionCount: subscriptions.length,
    sentCount,
    failedCount: subscriptions.length - sentCount,
  }
}
