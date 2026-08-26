const PUSH_ENDPOINT_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
])

export function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && PUSH_ENDPOINT_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function isPushEncryptionKey(value: string) {
  return value.length > 0 && value.length <= 512 && /^[A-Za-z0-9_-]+={0,2}$/.test(value)
}
