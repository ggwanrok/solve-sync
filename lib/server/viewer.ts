import { cache } from "react"
import { createClient } from "@/utils/supabase/server"

export const getViewer = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

export const getViewerExtension = cache(async () => {
  const { supabase, user } = await getViewer()
  if (!user) return null
  const { data } = await supabase
    .from("extension_connections")
    .select("created_at,last_seen_at")
    .eq("user_id", user.id)
    .maybeSingle()
  return data
})
