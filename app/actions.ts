"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getViewer } from "@/lib/server/viewer"
import { createAdminClient } from "@/utils/supabase/admin"
import { normalizeProblemMemoInput, type ProblemMemoInput } from "@/lib/problem-memo"

async function userClient() {
  const { supabase, user } = await getViewer()
  if (!user) redirect("/login")
  return { supabase, user }
}

function revalidateStudyFrom(formData: FormData) {
  const studyId = String(formData.get("studyId") || "")
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studyId)) {
    revalidatePath(`/study/${studyId}`)
  }
}

export async function sendFriendRequest(formData: FormData) {
  const { supabase } = await userClient()
  const raw = String(formData.get("handle") || "").trim().toLowerCase()
  if (!raw) return { status: "invalid" as const, message: "아이디를 입력해 주세요." }

  const { data, error } = await supabase.rpc("send_friend_request", { target_handle: raw.replace(/^@+/, "") })
  if (error) return { status: "error" as const, message: error.message }

  const status = data && typeof data === "object" && "status" in data ? data.status : null
  if (status === "incoming_pending") revalidatePath("/friends")

  switch (status) {
    case "sent":
      revalidatePath("/friends")
      revalidateStudyFrom(formData)
      return { status, message: "친구 요청을 보냈습니다." }
    case "already_sent":
      return { status, message: "이미 친구 요청을 보낸 사용자입니다." }
    case "incoming_pending":
      return { status, message: "이미 이 사용자에게 받은 요청이 있습니다. 받은 요청에서 수락해 주세요." }
    case "already_friends":
      return { status, message: "이미 친구인 사용자입니다." }
    case "self":
      return { status, message: "자기 자신에게는 친구 요청을 보낼 수 없습니다." }
    case "not_found":
      return { status, message: "해당 아이디의 사용자를 찾을 수 없습니다." }
    default:
      return { status: "error" as const, message: "친구 요청 상태를 확인하지 못했습니다." }
  }
}

export async function respondFriendRequest(formData: FormData) {
  const { supabase } = await userClient()
  const { error } = await supabase.rpc("respond_friend_request", {
    request_id: String(formData.get("requestId")),
    accept: formData.get("decision") === "accept",
  })
  if (error) throw new Error(error.message)
  revalidatePath("/friends")
  revalidatePath("/", "layout")
  revalidateStudyFrom(formData)
}

export async function cancelFriendRequest(requestId: string) {
  const { supabase } = await userClient()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return { ok: false as const, message: "취소할 친구 요청 정보가 올바르지 않습니다." }
  }

  const { data, error } = await supabase.rpc("cancel_friend_request", { request_id: requestId })
  if (error) {
    console.error("friend request cancellation failed", { requestId, code: error.code, message: error.message })
    return { ok: false as const, message: "친구 요청을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }
  if (!data) return { ok: false as const, message: "이미 처리되었거나 취소할 수 없는 친구 요청입니다." }

  revalidatePath("/friends")
  revalidatePath("/study", "layout")
  return { ok: true as const }
}

export async function removeFriend(friendId: string) {
  const { supabase, user } = await userClient()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(friendId)) {
    return { ok: false as const, message: "삭제할 친구 정보가 올바르지 않습니다." }
  }

  const admin = createAdminClient()
  if (admin) {
    const pairFilter = `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
    const { count, error } = await admin
      .from("friendships")
      .delete({ count: "exact" })
      .or(pairFilter)
    if (error) {
      console.error("friend removal failed", { userId: user.id, friendId, code: error.code, message: error.message })
      return { ok: false as const, message: "친구를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." }
    }
    if (!count) return { ok: false as const, message: "이미 친구 목록에서 삭제된 사용자입니다." }
  } else {
    const { data, error } = await supabase.rpc("remove_friend", { target_user: friendId })
    if (error) {
      console.error("remove_friend RPC failed", { userId: user.id, friendId, code: error.code, message: error.message })
      return { ok: false as const, message: "친구 삭제를 위한 서버 설정이 필요합니다." }
    }
    if (!data) return { ok: false as const, message: "이미 친구 목록에서 삭제된 사용자입니다." }
  }

  revalidatePath("/friends")
  revalidatePath("/study", "layout")
  return { ok: true as const }
}

export async function createStudyRoom(input: { name: string; description: string; goalPeriod: "daily" | "weekly"; goalCount: number; minDifficulty: number; password: string | null }) {
  const { supabase } = await userClient()
  const { error } = await supabase.rpc("create_study_room", {
    room_name: input.name,
    room_description: input.description,
    room_goal_period: input.goalPeriod,
    room_goal_count: input.goalCount,
    room_min_difficulty: input.minDifficulty,
    room_password: input.password,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/study")
}

export async function addStudyComment(studyId: string, message: string) {
  const { supabase, user } = await userClient()
  const { data, error } = await supabase
    .from("study_comments")
    .insert({ study_id: studyId, author_id: user.id, message: message.trim() })
    .select("id,study_id,author_id,message,created_at")
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function verifyStudyRoomPassword(studyId: string, password: string) {
  const { supabase } = await userClient()
  const { data, error } = await supabase.rpc("verify_study_room_password", {
    target_study: studyId,
    provided_password: password,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error("비밀번호가 올바르지 않습니다.")
  revalidatePath(`/study/${studyId}`)
}

export async function joinStudyRoom(studyId: string) {
  const { supabase } = await userClient()
  const { error } = await supabase.rpc("join_study_room", { target_study: studyId })
  if (error) throw new Error(error.message)
  revalidatePath("/study")
  revalidatePath(`/study/${studyId}`)
}

export async function completeGettingStartedGuide() {
  const { supabase, user } = await userClient()
  const { error } = await supabase.from("profiles").update({ guide_completed_at: new Date().toISOString() }).eq("id", user.id)
  if (error) throw new Error(error.message)
  revalidatePath("/")
}

export async function saveProblemMemo(input: ProblemMemoInput) {
  const normalized = normalizeProblemMemoInput(input)
  if (!normalized) return { ok: false as const, message: "저장할 문제 정보가 올바르지 않습니다." }

  const { supabase, user } = await userClient()
  const { data: solve, error: solveError } = await supabase
    .from("solve_events")
    .select("problem_id")
    .eq("user_id", user.id)
    .eq("platform", "programmers")
    .eq("problem_id", normalized.problemId)
    .maybeSingle()
  if (solveError || !solve) return { ok: false as const, message: "내가 풀이한 문제에서만 메모를 작성할 수 있습니다." }

  const updatedAt = new Date().toISOString()
  const { error } = await supabase.from("problem_memos").upsert({
    user_id: user.id,
    platform: "programmers",
    problem_id: normalized.problemId,
    algorithm_tags: normalized.algorithmTags,
    approach: normalized.approach,
    solution_code: normalized.solutionCode,
    difficulty_reason: normalized.difficultyReason,
    learnings: normalized.learnings,
    updated_at: updatedAt,
  }, { onConflict: "user_id,platform,problem_id" })
  if (error) {
    console.error("problem memo save failed", { userId: user.id, problemId: normalized.problemId, code: error.code, message: error.message })
    return { ok: false as const, message: "메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }

  revalidatePath("/notes")
  return { ok: true as const, updatedAt }
}

export async function deleteStudyRoom(studyId: string) {
  const { supabase } = await userClient()
  const { error } = await supabase.rpc("delete_study_room", { target_study: studyId })
  if (error) throw new Error(error.message)
  revalidatePath("/study")
}

export async function leaveStudyRoom(studyId: string) {
  const { supabase } = await userClient()
  const { error } = await supabase.rpc("leave_study_room", { target_study: studyId })
  if (error) throw new Error(error.message)
  revalidatePath("/study")
  revalidatePath(`/study/${studyId}`)
}
