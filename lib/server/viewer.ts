import { cache } from "react"
import { addCalendarDays, dayKey } from "@/lib/calendar"
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
    .select("handle,nickname,avatar_url,guide_completed_at")
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

export const getPendingFriendRequestCount = cache(async () => {
  const { supabase, user } = await getViewer()
  if (!user) return 0
  const { count, error } = await supabase
    .from("friend_requests")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("status", "pending")
  if (error) {
    console.error("pending friend request count failed", error)
    return 0
  }
  return count || 0
})

export type ViewerSidebarSolve = {
  title: string
  language: string | null
  difficulty: number | null
  accepted_at: string
  problem_id: string
}

export const getViewerSidebarSolves = cache(async () => {
  const { supabase, user } = await getViewer()
  if (!user) return [] as ViewerSidebarSolve[]

  const firstDate = addCalendarDays(dayKey(new Date()), -111)
  const { data } = await supabase
    .from("solve_events")
    .select("title,language,difficulty,accepted_at,problem_id")
    .eq("user_id", user.id)
    .gte("accepted_at", `${firstDate}T00:00:00+09:00`)
    .order("accepted_at", { ascending: true })

  return (data || []) as ViewerSidebarSolve[]
})
