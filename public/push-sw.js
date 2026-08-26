self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = typeof payload.title === "string" ? payload.title : "SolveSync"
  const body = typeof payload.body === "string" ? payload.body : "새로운 스터디 알림이 있습니다."
  const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//")
    ? payload.url
    : "/study"
  const tag = typeof payload.tag === "string" ? payload.tag : undefined

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: "/apple-icon.png",
    badge: "/icon-light-32x32.png",
    data: { url },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || "/study", self.location.origin).href

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true })
    const existingWindow = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existingWindow) {
      await existingWindow.navigate(targetUrl)
      return existingWindow.focus()
    }
    return clients.openWindow(targetUrl)
  })())
})
