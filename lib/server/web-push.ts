import webpush from "web-push"

export type WebPushPayload = {
  title: string
  body: string
  url: string
  tag: string
  urgency?: "very-low" | "low" | "normal" | "high"
  ttl?: number
}

export type StoredPushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
  expiration_time: string | null
}

function webPushConfig() {
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) return null
  return { subject, publicKey, privateKey }
}

export function isWebPushConfigured() {
  return webPushConfig() !== null
}

export async function sendWebPush(subscription: StoredPushSubscription, payload: WebPushPayload) {
  const config = webPushConfig()
  if (!config) throw new Error("웹 푸시 서버 설정이 완료되지 않았습니다.")

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expiration_time ? new Date(subscription.expiration_time).getTime() : null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    {
      TTL: payload.ttl ?? 6 * 60 * 60,
      urgency: payload.urgency || "normal",
      vapidDetails: config,
    },
  )
}

export function isExpiredPushSubscriptionError(error: unknown) {
  return error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)
}
