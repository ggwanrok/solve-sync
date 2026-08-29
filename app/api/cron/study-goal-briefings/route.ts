import { deliverScheduledStudyNotifications } from "@/lib/server/study-notification-cron"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  return deliverScheduledStudyNotifications(request, "briefing")
}
