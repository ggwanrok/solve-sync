import { cache } from "react"
import { addCalendarDays, dayKey } from "@/lib/calendar"
import { createClient } from "@/utils/supabase/server"
import type { ProblemMemoRecord, SolvedProblemNote } from "@/lib/problem-memo"
import type { StudyNotification, StudyNotificationInbox, StudyNotificationType } from "@/lib/study-notification"

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
    .select("handle,nickname,bio,avatar_url,guide_completed_at,problem_memo_prompt_enabled")
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
  const { data, error } = await supabase
    .from("extension_connections")
    .select("installation_id,device_name,created_at,last_seen_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) {
    console.error("viewer extension devices failed", error)
    return null
  }
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

type StudyNotificationRow = {
  id: string
  study_id: string
  type: StudyNotificationType
  title: string
  body: string
  url: string
  created_at: string
  read_at: string | null
}

export const getViewerStudyNotifications = cache(async (): Promise<StudyNotificationInbox> => {
  const { supabase, user } = await getViewer()
  if (!user) return { items: [], unreadCount: 0 }

  const [notifications, unread] = await Promise.all([
    supabase.rpc("my_study_notifications", { result_limit: 30 }),
    supabase.rpc("unread_study_notification_count"),
  ])
  if (notifications.error || unread.error) {
    console.error("study notification inbox failed", notifications.error || unread.error)
    return { items: [], unreadCount: 0 }
  }

  const items: StudyNotification[] = ((notifications.data || []) as StudyNotificationRow[]).map((item) => ({
    id: item.id,
    studyId: item.study_id,
    type: item.type,
    title: item.title,
    body: item.body,
    url: item.url,
    createdAt: item.created_at,
    readAt: item.read_at,
  }))
  return { items, unreadCount: Number(unread.data) || 0 }
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

type SolveRow = {
  id: string
  problem_id: string
  title: string
  url: string
  language: string | null
  problem_type: "algorithm" | "sql"
  difficulty: number | null
  accepted_at: string
}

type MemoRow = {
  problem_id: string
  algorithm_tags: string
  approach: string
  solution_code: string
  difficulty_reason: string
  learnings: string
  updated_at: string
}

export const getViewerProblemNotes = cache(async () => {
  const { supabase, user } = await getViewer()
  if (!user) return [] as SolvedProblemNote[]

  const { data: solves, error: solveError } = await supabase
    .from("solve_events")
    .select("id,problem_id,title,url,language,problem_type,difficulty,accepted_at")
    .eq("user_id", user.id)
    .eq("platform", "programmers")
    .order("accepted_at", { ascending: false })
    .limit(500)
  if (solveError) {
    console.error("problem memo solves failed", solveError)
    return [] as SolvedProblemNote[]
  }

  const solveRows = (solves || []) as SolveRow[]
  if (!solveRows.length) return [] as SolvedProblemNote[]

  const problemIds = solveRows.map((solve) => solve.problem_id)
  const { data: memos, error: memoError } = await supabase
    .from("problem_memos")
    .select("problem_id,algorithm_tags,approach,solution_code,difficulty_reason,learnings,updated_at")
    .eq("user_id", user.id)
    .eq("platform", "programmers")
    .in("problem_id", problemIds)
  if (memoError) console.error("problem memos failed", memoError)

  const memoByProblem = new Map((memos || []).map((memo) => [(memo as MemoRow).problem_id, memo as MemoRow]))

  return solveRows.map((solve) => {
    const memo = memoByProblem.get(solve.problem_id)
    return {
      id: solve.id,
      problemId: solve.problem_id,
      title: solve.title || `문제 ${solve.problem_id}`,
      url: solve.url,
      language: solve.language,
      problemType: solve.problem_type,
      difficulty: solve.difficulty,
      acceptedAt: solve.accepted_at,
      memo: memo ? {
        algorithmTags: memo.algorithm_tags,
        approach: memo.approach,
        solutionCode: memo.solution_code,
        difficultyReason: memo.difficulty_reason,
        learnings: memo.learnings,
        updatedAt: memo.updated_at,
      } : null,
    }
  }) satisfies SolvedProblemNote[]
})
