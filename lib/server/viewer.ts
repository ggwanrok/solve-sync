import { cache } from "react"
import { createClient } from "@/utils/supabase/server"

export const getViewer = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims.sub ? { id: data.claims.sub } : null
  return { supabase, user }
})

export const getViewerProfile = cache(async () => {
  const { supabase, user } = await getViewer()
  if (!user) return null
  const { data } = await supabase
    .from("profiles")
    .select("handle,nickname,guide_completed_at")
    .eq("id", user.id)
    .maybeSingle()
  return data
})

export type ViewerExtensionDevice = {
  installation_id: string
  device_name: string
  created_at: string
  last_seen_at: string | null
}

export const getViewerExtensions = cache(async () => {
  const { supabase, user } = await getViewer()
  if (!user) return [] as ViewerExtensionDevice[]
  const { data } = await supabase
    .from("extension_connections")
    .select("installation_id,device_name,created_at,last_seen_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  return (data || []) as ViewerExtensionDevice[]
})
