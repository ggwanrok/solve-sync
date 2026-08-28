"use client"

import { Bell, BellOff, CheckCircle2, LoaderCircle, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { authenticatedFetch } from "@/lib/authenticated-fetch"

const VERIFIED_PUSH_ENDPOINT_KEY = "solvesync:verified-push-endpoint"

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

function isVerifiedOnThisBrowser(subscription: PushSubscription) {
  try {
    return window.localStorage.getItem(VERIFIED_PUSH_ENDPOINT_KEY) === subscription.endpoint
  } catch {
    return false
  }
}

function rememberVerifiedBrowser(subscription: PushSubscription) {
  try {
    window.localStorage.setItem(VERIFIED_PUSH_ENDPOINT_KEY, subscription.endpoint)
  } catch {
    // Private browsing can deny storage. The current session still remains connected.
  }
}

function forgetVerifiedBrowser() {
  try {
    window.localStorage.removeItem(VERIFIED_PUSH_ENDPOINT_KEY)
  } catch {
    // Nothing else is needed when storage is unavailable.
  }
}

function systemNotificationGuide() {
  if (typeof navigator === "undefined") {
    return "기기의 시스템 알림 설정에서 현재 브라우저의 알림을 허용해 주세요."
  }
  const platform = navigator.userAgent.toLowerCase()
  if (platform.includes("mac")) {
    return "macOS 시스템 설정 → 알림 → Google Chrome → 알림 허용을 켜 주세요."
  }
  if (platform.includes("windows")) {
    return "Windows 설정 → 시스템 → 알림에서 Google Chrome 알림을 켜 주세요."
  }
  if (platform.includes("android")) {
    return "기기 설정 → 알림 → Chrome에서 알림을 허용해 주세요."
  }
  if (platform.includes("iphone") || platform.includes("ipad")) {
    return "설정 → 알림에서 SolveSync 알림을 허용해 주세요. iPhone은 홈 화면에 추가한 앱으로 열어야 웹 푸시를 받을 수 있어요."
  }
  return "기기의 시스템 알림 설정에서 현재 브라우저의 알림을 허용해 주세요."
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
    const registration = await navigator.serviceWorker.ready
    const existingSubscription = await registration.pushManager.getSubscription()

    if (existingSubscription && !usesApplicationServerKey(existingSubscription, expectedKey)) {
      forgetVerifiedBrowser()
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
  return subscription
}

type BrowserConnection = "checking" | "connected" | "disconnected"
type SetupStage = "guide" | "confirm" | "help"

export function StudyNotificationToggle({ studyId, initialEnabled }: { studyId: string; initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, setPending] = useState(false)
  const [browserConnection, setBrowserConnection] = useState<BrowserConnection>("checking")
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupStage, setSetupStage] = useState<SetupStage>("guide")
  const [setupPending, setSetupPending] = useState(false)
  const [testedSubscription, setTestedSubscription] = useState<PushSubscription | null>(null)

  useEffect(() => {
    let cancelled = false
    const synchronizeBrowser = async () => {
      if (!("Notification" in window) || Notification.permission !== "granted") {
        if (!cancelled) setBrowserConnection("disconnected")
        return
      }

      try {
        const subscription = await connectThisBrowser()
        if (!cancelled) {
          setBrowserConnection(isVerifiedOnThisBrowser(subscription) ? "connected" : "disconnected")
        }
      } catch {
        if (!cancelled) setBrowserConnection("disconnected")
      }
    }
    void synchronizeBrowser()

    return () => {
      cancelled = true
    }
  }, [])

  async function updateStudyNotifications(nextEnabled: boolean) {
    const response = await authenticatedFetch(`/api/studies/${studyId}/notifications`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: nextEnabled }),
    })
    if (!response.ok) throw new Error(await errorMessage(response, "스터디 알림 설정을 변경하지 못했습니다."))

    setEnabled(nextEnabled)
    toast.success(nextEnabled ? "이 스터디의 알림을 켰습니다." : "이 스터디의 알림을 껐습니다.")
    router.refresh()
  }

  function openSetup() {
    setSetupStage("guide")
    setTestedSubscription(null)
    setSetupOpen(true)
  }

  async function handleToggle() {
    if (browserConnection !== "connected") {
      openSetup()
      return
    }

    setPending(true)
    try {
      await updateStudyNotifications(!enabled)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스터디 알림 설정을 변경하지 못했습니다.")
    } finally {
      setPending(false)
    }
  }

  async function sendTestNotification() {
    setSetupPending(true)
    try {
      const subscription = await connectThisBrowser()
      const response = await authenticatedFetch("/api/push/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      if (!response.ok) {
        if (response.status === 410) {
          forgetVerifiedBrowser()
          await subscription.unsubscribe()
        }
        throw new Error(await errorMessage(response, "테스트 알림을 보내지 못했습니다."))
      }

      setTestedSubscription(subscription)
      setSetupStage("confirm")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "테스트 알림을 보내지 못했습니다.")
    } finally {
      setSetupPending(false)
    }
  }

  async function confirmTestNotification() {
    if (!testedSubscription) return
    setSetupPending(true)
    try {
      rememberVerifiedBrowser(testedSubscription)
      setBrowserConnection("connected")
      if (!enabled) await updateStudyNotifications(true)
      else toast.success("이 브라우저에 스터디 알림을 연결했습니다.")
      setSetupOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스터디 알림을 켜지 못했습니다.")
    } finally {
      setSetupPending(false)
    }
  }

  const needsBrowserVerification = enabled && browserConnection === "disconnected"
  const checkingConnection = browserConnection === "checking"
  const buttonLabel = pending
    ? "설정 중"
    : checkingConnection
      ? "연결 확인 중"
      : needsBrowserVerification
        ? "이 브라우저 확인"
        : enabled
          ? "스터디 알림 켜짐"
          : "스터디 알림 켜기"

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={enabled && !needsBrowserVerification ? "secondary" : "outline"}
        aria-label={needsBrowserVerification ? "이 브라우저의 스터디 알림 확인하기" : enabled ? "이 스터디의 알림 끄기" : "이 스터디의 알림 켜기"}
        aria-pressed={enabled && browserConnection === "connected"}
        onClick={handleToggle}
        disabled={pending || checkingConnection}
        className="gap-1.5"
      >
        {pending || checkingConnection ? <LoaderCircle className="animate-spin" /> : enabled && !needsBrowserVerification ? <Bell /> : <BellOff />}
        {buttonLabel}
      </Button>

      <Dialog open={setupOpen} onOpenChange={(open) => { if (!setupPending) setSetupOpen(open) }}>
        <DialogContent showCloseButton={!setupPending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>스터디 알림 준비</DialogTitle>
            <DialogDescription>
              시스템에서 브라우저 알림이 실제로 보이는지 확인한 뒤에만 스터디 알림이 켜져요.
            </DialogDescription>
          </DialogHeader>

          {setupStage === "guide" && (
            <>
              <div className="space-y-3 rounded-2xl bg-muted/55 p-4">
                <div className="flex gap-3">
                  <Settings className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium">1. 시스템 알림을 확인해 주세요</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{systemNotificationGuide()}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="font-medium">2. 테스트 알림을 보내요</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">사이트 알림 권한을 묻는 창이 나오면 허용을 눌러 주세요.</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSetupOpen(false)} disabled={setupPending}>나중에</Button>
                <Button type="button" onClick={sendTestNotification} disabled={setupPending}>
                  {setupPending && <LoaderCircle className="animate-spin" />}
                  {setupPending ? "보내는 중" : "테스트 알림 보내기"}
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStage === "confirm" && (
            <>
              <div className="rounded-2xl bg-muted/55 p-4 text-center">
                <CheckCircle2 className="mx-auto size-8 text-primary" aria-hidden="true" />
                <p className="mt-3 font-medium">방금 테스트 알림을 받았나요?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">시스템 알림 영역에 ‘SolveSync 알림 테스트’가 보여야 해요.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSetupStage("help")} disabled={setupPending}>못 받았어요</Button>
                <Button type="button" onClick={confirmTestNotification} disabled={setupPending}>
                  {setupPending && <LoaderCircle className="animate-spin" />}
                  {setupPending ? "켜는 중" : "알림 받았어요"}
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStage === "help" && (
            <>
              <div className="space-y-2 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/20">
                <p className="font-medium text-amber-800 dark:text-amber-300">시스템 알림 설정을 확인해 주세요</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{systemNotificationGuide()}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">방해 금지 모드나 집중 모드도 알림을 숨길 수 있어요.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSetupOpen(false)} disabled={setupPending}>닫기</Button>
                <Button type="button" onClick={sendTestNotification} disabled={setupPending}>
                  {setupPending && <LoaderCircle className="animate-spin" />}
                  {setupPending ? "보내는 중" : "설정 확인 후 다시 테스트"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
