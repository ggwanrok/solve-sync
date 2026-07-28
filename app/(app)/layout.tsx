import { AppShell } from "@/components/app-shell"
import { redirect } from "next/navigation"
import { getViewer, getViewerExtension, getViewerProfile } from "@/lib/server/viewer"

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const [{ user }, profile, extension] = await Promise.all([
    getViewer(),
    getViewerProfile(),
    getViewerExtension(),
  ])
  if (!user) redirect("/login")
  if (!profile?.handle) redirect("/onboarding")
  return <AppShell user={{ name: profile.nickname || profile.handle, handle: profile.handle, extensionConnected: Boolean(extension?.last_seen_at), extensionTokenCreatedAt: extension?.created_at || null, extensionLastSeenAt: extension?.last_seen_at || null }}>{children}</AppShell>
}
