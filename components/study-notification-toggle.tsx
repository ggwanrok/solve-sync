"use client"

import { Bell, BellOff, LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authenticatedFetch } from "@/lib/authenticated-fetch"

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

function usesApplicationServerKey(subscription: PushSubscription, expectedKey: Uint8Array<ArrayBuffer>) {
  const currentKey = subscription.options.applicationServerKey
  if (!currentKey) return true

  const currentBytes = new Uint8Array(currentKey)
  return currentBytes.length === expectedKey.length
    && currentBytes.every((value, index) => value === expectedKey[index])
}

function pushSetupError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return new Error("브라우저 설정에서 이 사이트의 알림을 허용해 주세요.")
    }
    if (error.name === "InvalidStateError" || error.name === "AbortError") {
      return new Error("브라우저 알림을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
  }
  return error instanceof Error ? error : new Error("브라우저 알림을 연결하지 못했습니다.")
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const result = await response.json() as { error?: string }
    return result.error || fallback
  } catch {
    return fallback
  }
}

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

  const expectedKey = applicationServerKey(publicKey)
  let subscription: PushSubscription
  try {
    await navigator.serviceWorker.register("/push-sw.js", { scope: "/" })
    // A newly registered worker is not always active yet. Subscribing before
    // `ready` resolves makes the first attempt fail with InvalidStateError.
    const registration = await navigator.serviceWorker.ready
    const existingSubscription = await registration.pushManager.getSubscription()

    if (existingSubscription && !usesApplicationServerKey(existingSubscription, expectedKey)) {
      await existingSubscription.unsubscribe()
    }

    subscription = existingSubscription && usesApplicationServerKey(existingSubscription, expectedKey)
      ? existingSubscription
      : await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: expectedKey,
        })
  } catch (error) {
    throw pushSetupError(error)
  }

  const response = await authenticatedFetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!response.ok) throw new Error(await errorMessage(response, "브라우저 알림을 연결하지 못했습니다."))
}

type BrowserConnection = "checking" | "connected" | "disconnected"

export function StudyNotificationToggle({ studyId, initialEnabled }: { studyId: string; initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, setPending] = useState(false)
  const [browserConnection, setBrowserConnection] = useState<BrowserConnection>(initialEnabled ? "checking" : "disconnected")

  useEffect(() => {
    let cancelled = false
    const synchronizeBrowser = async () => {
      if (!initialEnabled || !("Notification" in window) || Notification.permission !== "granted") {
        if (!cancelled) setBrowserConnection("disconnected")
        return
      }

      try {
        await connectThisBrowser()
        if (!cancelled) setBrowserConnection("connected")
      } catch {
        if (!cancelled) setBrowserConnection("disconnected")
      }
    }
    void synchronizeBrowser()

    return () => {
      cancelled = true
    }
  }, [initialEnabled])

  async function toggleNotifications() {
    const connectsEnabledStudy = enabled && browserConnection !== "connected"
    const nextEnabled = !enabled
    setPending(true)
    try {
      if (connectsEnabledStudy) {
        await connectThisBrowser()
        setBrowserConnection("connected")
        toast.success("이 브라우저에 스터디 알림을 연결했습니다.")
        return
      }

      if (nextEnabled) await connectThisBrowser()

      const response = await authenticatedFetch(`/api/studies/${studyId}/notifications`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      })
      if (!response.ok) throw new Error(await errorMessage(response, "스터디 알림 설정을 변경하지 못했습니다."))

      setEnabled(nextEnabled)
      setBrowserConnection(nextEnabled ? "connected" : "disconnected")
      toast.success(nextEnabled ? "이 스터디의 알림을 켰습니다." : "이 스터디의 알림을 꺐습니다.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스터디 알림 설정을 변경하지 못했습니다.")
    } finally {
      setPending(false)
    }
  }

  const needsBrowserConnection = enabled && browserConnection === "disconnected"
  const checkingConnection = enabled && browserConnection === "checking"
  const buttonLabel = pending
    ? "설정 중"
    : checkingConnection
      ? "연결 확인 중"
      : needsBrowserConnection
        ? "이 브라우저 연결"
        : enabled
          ? "스터디 알림 켜짐"
          : "스터디 알림 켜기"

  return (
    <Button
      type="button"
      size="sm"
      variant={enabled && !needsBrowserConnection ? "secondary" : "outline"}
      aria-label={needsBrowserConnection ? "이 브라우저에 스터디 알림 연결하기" : enabled ? "이 스터디의 알림 끄기" : "이 스터디의 알림 켜기"}
      aria-pressed={enabled && browserConnection === "connected"}
      onClick={toggleNotifications}
      disabled={pending || checkingConnection}
      className="gap-1.5"
    >
      {pending || checkingConnection ? <LoaderCircle className="animate-spin" /> : enabled && !needsBrowserConnection ? <Bell /> : <BellOff />}
      {buttonLabel}
    </Button>
  )
}
