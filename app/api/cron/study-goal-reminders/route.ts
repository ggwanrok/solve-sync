import { NextResponse } from "next/server"
import { deliverPushToUser } from "@/lib/server/push-delivery"
import { isWebPushConfigured } from "@/lib/server/web-push"
import { createAdminClient } from "@/utils/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type ClaimedReminder = {
  notification_id: string
  recipient_id: string
  title: string
  body: string
  url: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 401 })
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "웹 푸시 서버 설정이 완료되지 않았습니다." }, { status: 503 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const { data, error } = await admin.rpc("claim_study_goal_reminders")
  if (error) {
    console.error("study goal reminder claim failed", { code: error.code, message: error.message })
    return NextResponse.json({ error: "목표 알림 대상을 계산하지 못했습니다." }, { status: 500 })
  }

  const reminders = (data || []) as ClaimedReminder[]
  let sentCount = 0
  let failedCount = 0

  await Promise.all(reminders.map(async (reminder) => {
    try {
      const delivery = await deliverPushToUser(admin, reminder.recipient_id, {
        title: reminder.title,
        body: reminder.body,
        url: reminder.url,
        tag: `goal-${reminder.notification_id}`,
      })
      if (delivery.sentCount > 0) {
        const { error: updateError } = await admin
          .from("study_notifications")
          .update({ pushed_at: new Date().toISOString() })
          .eq("id", reminder.notification_id)
        if (updateError) throw updateError
        sentCount += 1
      } else {
        await admin.from("study_notifications").update({ push_attempted_at: null }).eq("id", reminder.notification_id)
        failedCount += 1
      }
    } catch (deliveryError) {
      failedCount += 1
      await admin.from("study_notifications").update({ push_attempted_at: null }).eq("id", reminder.notification_id)
      console.error("study goal reminder delivery failed", {
        notificationId: reminder.notification_id,
        error: deliveryError instanceof Error ? deliveryError.message : "unknown",
      })
    }
  }))

  return NextResponse.json({ claimed: reminders.length, sent: sentCount, failed: failedCount })
}
