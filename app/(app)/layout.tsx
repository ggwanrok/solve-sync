import { AppShell } from "@/components/app-shell"
import { redirect } from "next/navigation"
import { getViewer, getViewerExtensions, getViewerProfile } from "@/lib/server/viewer"

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, profile, extensions] = await Promise.all([
    getViewer(),
    getViewerProfile(),
    getViewerExtensions(),
  ])
  if (!user) redirect("/login")
  if (!profile?.handle) redirect("/onboarding")
  return <AppShell user={{
    name: profile.nickname || profile.handle,
    handle: profile.handle,
    extensionConnected: extensions.length > 0,
    extensionDevices: extensions.map((device) => ({
      installationId: device.installation_id,
      deviceName: device.device_name,
      connectedAt: device.created_at,
      lastSeenAt: device.last_seen_at,
    })),
  }}>{children}</AppShell>
}
