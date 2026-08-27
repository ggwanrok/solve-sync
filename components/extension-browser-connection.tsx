"use client"

import { CircleAlert, LoaderCircle, Puzzle } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const DEFAULT_EXTENSION_ID = "dgghaooaokpafdhjgieajelgbilacmkd"
const EXTENSION_RESPONSE_TIMEOUT_MS = 2_000

type ExternalConnectionResponse = {
  installed?: boolean
  connected?: boolean
  authRequired?: boolean
  unavailable?: boolean
  accountId?: string
}

type ChromeRuntime = {
  lastError?: { message?: string }
  sendMessage: (
    extensionId: string,
    message: { type: "GET_CONNECTION_STATUS" },
    callback: (response?: ExternalConnectionResponse) => void,
  ) => void
}

export type ExtensionBrowserStatus =
  | "checking"
  | "connected"
  | "different-account"
  | "disconnected"
  | "not-detected"
  | "unavailable"

export const extensionBrowserStatusCopy: Record<ExtensionBrowserStatus, { label: string; description: string }> = {
  checking: {
    label: "확인 중",
    description: "현재 브라우저의 SolveSync 확장 프로그램 상태를 확인하고 있습니다.",
  },
  connected: {
    label: "연동됨",
    description: "현재 브라우저의 확장 프로그램이 이 계정에 연결되어 있습니다.",
  },
  "different-account": {
    label: "다른 계정",
    description: "현재 브라우저의 확장 프로그램이 다른 SolveSync 계정에 연결되어 있습니다.",
  },
  disconnected: {
    label: "미연동",
    description: "확장 프로그램은 설치되어 있지만 현재 계정에 연결되어 있지 않습니다.",
  },
  "not-detected": {
    label: "확인 필요",
    description: "확장 프로그램이 설치되어 있지 않거나 현재 버전에서는 상태 확인을 지원하지 않습니다.",
  },
  unavailable: {
    label: "확인 불가",
    description: "현재 브라우저의 연동 상태를 확인하지 못했습니다. 잠시 후 새로고침해 주세요.",
  },
}

function runtimeFromWindow() {
  return (window as Window & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
}

function requestConnectionStatus(runtime: ChromeRuntime) {
  const extensionId = process.env.NEXT_PUBLIC_SOLVESYNC_EXTENSION_ID || DEFAULT_EXTENSION_ID

  return new Promise<ExternalConnectionResponse | null>((resolve) => {
    let settled = false
    const finish = (response: ExternalConnectionResponse | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(response)
    }
    const timeout = window.setTimeout(() => finish(null), EXTENSION_RESPONSE_TIMEOUT_MS)

    try {
      runtime.sendMessage(extensionId, { type: "GET_CONNECTION_STATUS" }, (response) => {
        if (runtime.lastError) return finish(null)
        finish(response?.installed ? response : null)
      })
    } catch {
      finish(null)
    }
  })
}

export function useExtensionBrowserStatus(accountId: string, connectionVersion: string) {
  const [status, setStatus] = useState<ExtensionBrowserStatus>("checking")

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      setStatus("checking")
      const runtime = runtimeFromWindow()
      if (!runtime) {
        if (!cancelled) setStatus("not-detected")
        return
      }

      const response = await requestConnectionStatus(runtime)
      if (cancelled) return
      if (!response) setStatus("not-detected")
      else if (response.unavailable) setStatus("unavailable")
      else if (!response.connected) setStatus("disconnected")
      else if (response.accountId === accountId) setStatus("connected")
      else setStatus("different-account")
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [accountId, connectionVersion])

  return status
}

export function ExtensionBrowserBadge({ status, className }: { status: ExtensionBrowserStatus; className?: string }) {
  const copy = extensionBrowserStatusCopy[status]
  const Icon = status === "checking" ? LoaderCircle : status === "unavailable" ? CircleAlert : Puzzle

  return (
    <Badge variant="outline" className={cn("gap-1.5", className)} title={copy.description}>
      <Icon className={cn("size-3.5", status === "checking" && "animate-spin", status === "connected" ? "text-primary" : "text-muted-foreground")} />
      현재 브라우저 {copy.label}
    </Badge>
  )
}
