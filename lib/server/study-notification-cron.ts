import { NextResponse } from "next/server"
import { deliverPushToUser } from "@/lib/server/push-delivery"
import { isWebPushConfigured } from "@/lib/server/web-push"
import { createAdminClient } from "@/utils/supabase/admin"

export type StudyNotificationPhase = "reminder" | "briefing"

type ClaimedNotification = {
  notification_id: string
  recipient_id: string
  notification_type: "goal_reminder" | "goal_missed"
  title: string
  body: string
  url: string
}

export async function deliverScheduledStudyNotifications(
  request: Request,
  phase: StudyNotificationPhase,
) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 401 })
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "웹 푸시 서버 설정이 완료되지 않았습니다." }, { status: 503 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const { data, error } = await admin.rpc("claim_study_notifications", { notification_phase: phase })
  if (error) {
    console.error("scheduled study notification claim failed", { phase, code: error.code, message: error.message })
    return NextResponse.json({ error: "스터디 알림 대상을 계산하지 못했습니다." }, { status: 500 })
  }

  const notifications = (data || []) as ClaimedNotification[]
  let sentCount = 0
  let failedCount = 0

  await Promise.all(notifications.map(async (notification) => {
    try {
      const delivery = await deliverPushToUser(admin, notification.recipient_id, {
        title: notification.title,
        body: notification.body,
        url: notification.url,
        tag: `study-${notification.notification_type}-${notification.notification_id}`,
      })
      if (delivery.sentCount > 0) {
        const { error: updateError } = await admin
          .from("study_notifications")
          .update({ pushed_at: new Date().toISOString() })
          .eq("id", notification.notification_id)
        if (updateError) throw updateError
        sentCount += 1
      } else {
        await admin.from("study_notifications").update({ push_attempted_at: null }).eq("id", notification.notification_id)
        failedCount += 1
      }
    } catch (deliveryError) {
      failedCount += 1
      await admin.from("study_notifications").update({ push_attempted_at: null }).eq("id", notification.notification_id)
      console.error("scheduled study notification delivery failed", {
        phase,
        notificationId: notification.notification_id,
        error: deliveryError instanceof Error ? deliveryError.message : "unknown",
      })
    }
  }))

  return NextResponse.json({ phase, claimed: notifications.length, sent: sentCount, failed: failedCount })
}
