"use client"

import { Bell, BellOff, LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authenticatedFetch } from "@/lib/authenticated-fetch"

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const result = await response.json() as { error?: string }
    return result.error || fallback
  } catch {
    return fallback
  }
}

export function StudyNotificationToggle({ studyId, initialEnabled }: { studyId: string; initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, setPending] = useState(false)

  async function connectThisBrowser() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("이 브라우저는 웹 푸시 알림을 지원하지 않습니다.")
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) throw new Error("웹 푸시 공개 키가 설정되지 않았습니다.")

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission()
    if (permission !== "granted") {
      throw new Error("브라우저 알림 권한을 허용해야 스터디 알림을 켤 수 있습니다.")
    }

    const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" })
    const existingSubscription = await registration.pushManager.getSubscription()
    const subscription = existingSubscription || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(publicKey),
    })

    const response = await authenticatedFetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    })
    if (!response.ok) throw new Error(await errorMessage(response, "브라우저 알림을 연결하지 못했습니다."))
  }

  async function toggleNotifications() {
    const nextEnabled = !enabled
    setPending(true)
    try {
      if (nextEnabled) await connectThisBrowser()

      const response = await authenticatedFetch(`/api/studies/${studyId}/notifications`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      })
      if (!response.ok) throw new Error(await errorMessage(response, "스터디 알림 설정을 변경하지 못했습니다."))

      setEnabled(nextEnabled)
      toast.success(nextEnabled ? "이 스터디의 알림을 켰습니다." : "이 스터디의 알림을 껐습니다.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스터디 알림 설정을 변경하지 못했습니다.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        type="button"
        size="sm"
        variant={enabled ? "secondary" : "outline"}
        aria-label={enabled ? "이 스터디의 알림 끄기" : "이 스터디의 알림 켜기"}
        aria-pressed={enabled}
        onClick={toggleNotifications}
        disabled={pending}
        className="gap-1.5"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : enabled ? <Bell /> : <BellOff />}
        {pending ? "설정 중" : enabled ? "스터디 알림 켜짐" : "스터디 알림 켜기"}
      </Button>
      <p className="text-[11px] text-muted-foreground">마감 6시간 전 알림 · 콕 찌르기</p>
    </div>
  )
}
