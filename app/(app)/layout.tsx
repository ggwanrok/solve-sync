import { AppShell } from "@/components/app-shell"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const [{ data: profile }, { data: extension }] = await Promise.all([
    supabase.from("profiles").select("handle,nickname").eq("id", user.id).maybeSingle(),
    supabase.from("extension_connections").select("created_at,last_seen_at").eq("user_id", user.id).maybeSingle(),
  ])
  if (!profile?.handle) redirect("/onboarding")
  return <AppShell user={{ name: profile.nickname || profile.handle, handle: profile.handle, extensionConnected: Boolean(extension?.last_seen_at), extensionTokenCreatedAt: extension?.created_at || null, extensionLastSeenAt: extension?.last_seen_at || null }}>{children}</AppShell>
}
