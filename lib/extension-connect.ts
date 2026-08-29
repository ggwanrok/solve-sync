const EXTENSION_ID_PATTERN = /^[a-p]{32}$/
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const CONNECTION_CODE_TTL_MS = 5 * 60_000
export const MAX_EXTENSION_CONNECTIONS = 5
export const EXTENSION_CONNECTION_LIMIT_ERROR = "EXTENSION_CONNECTION_LIMIT_REACHED"
export const EXTENSION_CONNECTION_LIMIT_MESSAGE = `브라우저는 계정당 최대 ${MAX_EXTENSION_CONNECTIONS}개까지 연동할 수 있습니다. 기존 연동을 해제한 뒤 다시 시도해 주세요.`

export function canConnectExtensionInstallation(currentInstallationIds: string[], installationId: string) {
  return currentInstallationIds.includes(installationId) || currentInstallationIds.length < MAX_EXTENSION_CONNECTIONS
}

export function isExtensionConnectionLimitError(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) return false
  return typeof error.message === "string" && error.message.includes(EXTENSION_CONNECTION_LIMIT_ERROR)
}

export function isValidInstallationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

export function normalizeDeviceName(value: unknown) {
  if (typeof value !== "string") return null
  const name = value.replace(/\s+/g, " ").trim().slice(0, 80)
  return name || null
}

export function isValidState(value: unknown): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 180 && BASE64URL_PATTERN.test(value)
}

export function isValidCodeChallenge(value: unknown): value is string {
  return typeof value === "string" && value.length >= 43 && value.length <= 128 && BASE64URL_PATTERN.test(value)
}

export function isValidCodeVerifier(value: unknown): value is string {
  return typeof value === "string" && value.length >= 43 && value.length <= 128 && BASE64URL_PATTERN.test(value)
}

export function parseExtensionRedirectUri(value: unknown) {
  if (typeof value !== "string" || value.length > 300) return null

  try {
    const url = new URL(value)
    const hostMatch = url.hostname.match(/^([a-p]{32})\.chromiumapp\.org$/)
    if (url.protocol !== "https:" || !hostMatch || !EXTENSION_ID_PATTERN.test(hostMatch[1])) return null
    if (url.pathname !== "/solvesync" && url.pathname !== "/solvesync/") return null
    if (url.username || url.password || url.search || url.hash || url.port) return null

    const allowedIds = (process.env.SOLVESYNC_EXTENSION_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
    if (allowedIds.length && !allowedIds.includes(hostMatch[1])) return null

    return { url, extensionId: hostMatch[1] }
  } catch {
    return null
  }
}
