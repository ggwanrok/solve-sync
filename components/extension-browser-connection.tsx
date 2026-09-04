"use client"

import { CircleAlert, LoaderCircle, Puzzle, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  extensionBrowserStatusCopy,
  registeredExtensionDevicesLabel,
  requestExtensionBrowserStatus,
  type ChromeRuntime,
  type ExtensionBrowserStatus,
  type ExtensionDevice,
} from "@/lib/extension-browser-connection"
import { cn } from "@/lib/utils"

function useExtensionBrowserStatus(accountId: string, connectionVersion: string, refreshDevices: () => void) {
  const [status, setStatus] = useState<ExtensionBrowserStatus>("checking")
  const recheckRef = useRef<() => void>(() => {})
  const recheck = useCallback(() => recheckRef.current(), [])

  useEffect(() => {
    let cancelled = false
    let controller: AbortController | null = null
    let scheduled: ReturnType<typeof setTimeout> | undefined

    const check = (refreshAccount = false) => {
      if (refreshAccount) refreshDevices()
      controller?.abort()
      const requestController = new AbortController()
      controller = requestController
      setStatus("checking")
      const runtime = (window as Window & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
      return requestExtensionBrowserStatus(runtime, accountId, requestController.signal)
        .then((nextStatus) => {
          if (!cancelled && !requestController.signal.aborted) setStatus(nextStatus)
        })
    }

    const recheckNow = () => {
      clearTimeout(scheduled)
      void check(true)
    }
    const onReturn = () => {
      if (document.visibilityState !== "visible") return
      // Tab visibility and window focus often change together; refresh once for both.
      clearTimeout(scheduled)
      scheduled = setTimeout(recheckNow, 150)
    }

    recheckRef.current = recheckNow
    void check()
    window.addEventListener("focus", onReturn)
    window.addEventListener("online", onReturn)
    document.addEventListener("visibilitychange", onReturn)
    return () => {
      cancelled = true
      controller?.abort()
      clearTimeout(scheduled)
      recheckRef.current = () => {}
      window.removeEventListener("focus", onReturn)
      window.removeEventListener("online", onReturn)
      document.removeEventListener("visibilitychange", onReturn)
    }
  }, [accountId, connectionVersion, refreshDevices])

  return { status, recheck }
}

type ExtensionConnectionState = {
  devices: ExtensionDevice[] | null
  status: ExtensionBrowserStatus
  recheck: () => void
}

const ExtensionConnectionContext = createContext<ExtensionConnectionState | null>(null)

export function ExtensionConnectionProvider({ accountId, devices, children }: {
  accountId: string
  devices: ExtensionDevice[] | null
  children: ReactNode
}) {
  const router = useRouter()
  const refreshDevices = useCallback(() => router.refresh(), [router])
  const connectionVersion = devices?.map((device) => device.installationId).join(",") ?? "unavailable"
  const { status, recheck } = useExtensionBrowserStatus(accountId, connectionVersion, refreshDevices)

  return (
    <ExtensionConnectionContext.Provider value={{ devices, status, recheck }}>
      {children}
    </ExtensionConnectionContext.Provider>
  )
}

export function useExtensionConnection() {
  const connection = useContext(ExtensionConnectionContext)
  if (!connection) throw new Error("ExtensionConnectionProvider is required")
  return connection
}

export function RegisteredExtensionDevicesBadge() {
  const { devices } = useExtensionConnection()
  return <Badge variant="secondary">{registeredExtensionDevicesLabel(devices?.length ?? null)}</Badge>
}

export function ExtensionBrowserBadge({ status, showScope = true }: { status: ExtensionBrowserStatus; showScope?: boolean }) {
  const copy = extensionBrowserStatusCopy[status]
  const Icon = status === "checking" ? LoaderCircle : status === "unavailable" || status === "timeout" ? CircleAlert : Puzzle

  return (
    <Badge variant="outline" className="gap-1.5" title={copy.description}>
      <Icon className={cn("size-3.5", status === "checking" && "animate-spin", status === "connected" ? "text-primary" : "text-muted-foreground")} />
      {showScope ? `현재 브라우저: ${copy.label}` : copy.label}
    </Badge>
  )
}

export function ExtensionBrowserHeader({ className }: { className?: string }) {
  const { status, recheck } = useExtensionConnection()
  return (
    <div className={cn("items-center gap-1", className)}>
      <span role="status"><ExtensionBrowserBadge status={status} /></span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={recheck} disabled={status === "checking"} aria-label="연결 상태 다시 확인" title="연결 상태 다시 확인">
        <RefreshCw className={status === "checking" ? "animate-spin" : undefined} />
      </Button>
    </div>
  )
}

export function ExtensionBrowserStatusPanel({ className }: { className?: string }) {
  const { status, recheck } = useExtensionConnection()
  return (
    <div className={cn("rounded-xl bg-card p-3 shadow-sm", className)}>
      <div role="status" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">현재 브라우저</p>
          <ExtensionBrowserBadge status={status} showScope={false} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{extensionBrowserStatusCopy[status].description}</p>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={recheck} disabled={status === "checking"}>
        <RefreshCw className={status === "checking" ? "animate-spin" : undefined} />
        {status === "checking" ? "확인 중" : "다시 확인"}
      </Button>
    </div>
  )
}
