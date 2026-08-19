import { AppShell } from "@/components/app-shell"
import { redirect } from "next/navigation"
import { getPendingFriendRequestCount, getViewer, getViewerExtensions, getViewerProfile } from "@/lib/server/viewer"

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, profile, extensions, pendingFriendRequestCount] = await Promise.all([
    getViewer(),
    getViewerProfile(),
    getViewerExtensions(),
    getPendingFriendRequestCount(),
  ])
  if (!user) redirect("/login")
  if (!profile?.handle) redirect("/onboarding")
  return <AppShell user={{
    name: profile.nickname || profile.handle,
    handle: profile.handle,
    avatarUrl: profile.avatar_url,
    pendingFriendRequestCount,
    extensionConnected: extensions.length > 0,
    extensionDevices: extensions.map((device) => ({
      installationId: device.installation_id,
      deviceName: device.device_name,
      connectedAt: device.created_at,
      lastSeenAt: device.last_seen_at,
    })),
  }}>{children}</AppShell>
}
