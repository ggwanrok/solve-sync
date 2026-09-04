const DEFAULT_EXTENSION_ID = "dgghaooaokpafdhjgieajelgbilacmkd"
const EXTENSION_RESPONSE_TIMEOUT_MS = 10_000

export type ExtensionDevice = {
  installationId: string
  deviceName: string
  connectedAt: string
  lastSeenAt: string | null
}

export type ExternalConnectionResponse = {
  installed?: boolean
  connected?: boolean
  authRequired?: boolean
  unavailable?: boolean
  accountId?: string
}

export type ChromeRuntime = {
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
  | "reconnect-required"
  | "not-detected"
  | "timeout"
  | "unavailable"

export const extensionBrowserStatusCopy: Record<ExtensionBrowserStatus, { label: string; description: string }> = {
  checking: {
    label: "확인 중",
    description: "현재 브라우저의 확장 프로그램이 이 계정에 연결되어 있는지 확인하고 있습니다.",
  },
  connected: {
    label: "연결됨",
    description: "현재 브라우저의 SolveSync 확장 프로그램이 이 계정에 연결되어 있습니다.",
  },
  "different-account": {
    label: "다른 계정에 연결됨",
    description: "확장 프로그램이 다른 계정에 연결되어 있습니다. SolveSync 확장 프로그램을 열어 연결을 해제한 뒤 이 계정으로 다시 연결해 주세요.",
  },
  disconnected: {
    label: "연결 필요",
    description: "SolveSync 확장 프로그램을 열고 ‘SolveSync 계정 연결’을 눌러 주세요.",
  },
  "reconnect-required": {
    label: "다시 연결 필요",
    description: "기존 연결을 사용할 수 없습니다. SolveSync 확장 프로그램을 열고 ‘계정 다시 연결’을 눌러 주세요.",
  },
  "not-detected": {
    label: "확인할 수 없음",
    description: "이 브라우저에서 확장 프로그램을 감지하지 못했습니다. 데스크톱 Chrome에서 SolveSync 확장 프로그램을 열어 연결 상태를 확인해 주세요.",
  },
  timeout: {
    label: "응답 지연",
    description: "응답이 늦어 연결 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.",
  },
  unavailable: {
    label: "확인할 수 없음",
    description: "연결 상태를 확인하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 확인해 주세요.",
  },
}

export function registeredExtensionDevicesLabel(count: number | null) {
  return count === null ? "계정에 등록된 기기 확인 불가" : `계정에 등록된 기기 ${count}개`
}

function responseStatus(response: ExternalConnectionResponse | undefined, accountId: string): ExtensionBrowserStatus {
  if (!response?.installed) return "unavailable"
  if (response.unavailable) return "unavailable"
  if (response.authRequired) return "reconnect-required"
  if (response.connected === false) return "disconnected"
  if (response.connected !== true || !response.accountId) return "unavailable"
  return response.accountId === accountId ? "connected" : "different-account"
}

export function requestExtensionBrowserStatus(
  runtime: ChromeRuntime | undefined,
  accountId: string,
  signal?: AbortSignal,
): Promise<ExtensionBrowserStatus> {
  if (signal?.aborted) return Promise.resolve("unavailable")
  if (!runtime?.sendMessage) return Promise.resolve("not-detected")

  const extensionId = process.env.NEXT_PUBLIC_SOLVESYNC_EXTENSION_ID || DEFAULT_EXTENSION_ID
  return new Promise((resolve) => {
    let settled = false
    const finish = (status: ExtensionBrowserStatus) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      signal?.removeEventListener("abort", onAbort)
      resolve(status)
    }
    const onAbort = () => finish("unavailable")
    const timeout = setTimeout(() => finish("timeout"), EXTENSION_RESPONSE_TIMEOUT_MS)
    signal?.addEventListener("abort", onAbort, { once: true })

    try {
      runtime.sendMessage(extensionId, { type: "GET_CONNECTION_STATUS" }, (response) => {
        // Read lastError even after cancellation so Chrome does not log an unchecked error.
        if (runtime.lastError) return finish("not-detected")
        finish(responseStatus(response, accountId))
      })
    } catch {
      finish("not-detected")
    }
  })
}
