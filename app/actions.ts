"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getViewer } from "@/lib/server/viewer"

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
  if (!raw) return { status: "invalid" as const, message: "닉네임을 입력해 주세요." }

  const { data, error } = await supabase.rpc("send_friend_request", { target_handle: raw.replace(/^@+/, "") })
  if (error) return { status: "error" as const, message: error.message }

  const status = data && typeof data === "object" && "status" in data ? data.status : null
  if (status === "incoming_pending") revalidatePath("/friends")

  switch (status) {
    case "sent":
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
      return { status, message: "해당 닉네임의 사용자를 찾을 수 없습니다." }
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
