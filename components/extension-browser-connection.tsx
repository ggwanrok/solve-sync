"use client"

import { ArrowRight, CircleAlert, Chrome, LoaderCircle, Puzzle, RefreshCw } from "lucide-react"
import { Popover } from "@base-ui/react/popover"
import Link from "next/link"
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

export function ExtensionBrowserBadge({ status, showScope = true, className }: { status: ExtensionBrowserStatus; showScope?: boolean; className?: string }) {
  const copy = extensionBrowserStatusCopy[status]
  const Icon = status === "checking" ? LoaderCircle : status === "unavailable" || status === "timeout" ? CircleAlert : Puzzle

  return (
    <Badge variant="outline" className={cn("gap-1.5", className)} title={copy.description}>
      <Icon className={cn("size-3.5 shrink-0", status === "checking" && "animate-spin", status === "connected" ? "text-primary" : "text-muted-foreground")} />
      {showScope ? `현재 브라우저: ${copy.label}` : copy.label}
    </Badge>
  )
}

export function ExtensionBrowserIndicator({ className }: { className?: string }) {
  const { status } = useExtensionConnection()
  const copy = extensionBrowserStatusCopy[status]
  const connected = status === "connected"
  return (
    <span role="status" className={cn("flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted-foreground", className)} title={copy.description}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", connected ? "bg-primary" : "bg-muted-foreground", status === "checking" && "animate-pulse")} />
      <span>현재 브라우저</span>
      <span className={cn("font-medium", connected && "text-primary")}>{copy.label}</span>
    </span>
  )
}

export function ExtensionConnectionMenu() {
  const { status } = useExtensionConnection()
  const [open, setOpen] = useState(false)
  const label = status === "checking"
    ? "현재 브라우저 연결 중"
    : status === "connected"
      ? "현재 브라우저 연결됨"
      : "현재 브라우저 연결 안 됨"
  const dotClass = status === "checking" ? "bg-amber-500 animate-pulse" : status === "connected" ? "bg-primary" : "bg-destructive"

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-border/85 bg-card px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/35 sm:px-3">
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dotClass)} />
        <span role="status" aria-live="polite">{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-popover p-3 text-popover-foreground shadow-[0_16px_48px_rgba(15,23,42,0.16)] ring-1 ring-foreground/[0.065] outline-none">
            <Popover.Title className="sr-only">브라우저 연결 상태</Popover.Title>
            <div className="flex items-center gap-2 px-1 py-1 text-sm font-semibold">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", dotClass)} />
              {label}
            </div>
            <Popover.Description className="px-1 py-1 text-xs leading-relaxed text-muted-foreground">
              {extensionBrowserStatusCopy[status].description}
            </Popover.Description>
            <Link href="/programmers" onClick={() => setOpen(false)} className="mt-2 flex min-h-9 items-center gap-2 rounded-lg border-t border-border px-1 pt-2 text-xs font-medium transition-colors hover:text-primary">
              <Chrome className="size-4 text-muted-foreground" aria-hidden="true" />
              프로그래머스 연동방법
              <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
        {status !== "connected" && <p className="text-xs leading-relaxed text-muted-foreground">{extensionBrowserStatusCopy[status].description}</p>}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={recheck} disabled={status === "checking"}>
        <RefreshCw className={status === "checking" ? "animate-spin" : undefined} />
        {status === "checking" ? "확인 중" : "다시 확인"}
      </Button>
    </div>
  )
}
