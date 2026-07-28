"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

async function userClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return { supabase, user }
}

export async function sendFriendRequest(formData: FormData) {
  const { supabase } = await userClient()
  const raw = String(formData.get("handle") || "").trim().toLowerCase()
  if (!raw) return
  const { error } = await supabase.rpc("send_friend_request", { target_handle: raw.replace(/^@+/, "") })
  if (error) throw new Error(error.message)
  revalidatePath("/friends")
}

export async function respondFriendRequest(formData: FormData) {
  const { supabase } = await userClient()
  const { error } = await supabase.rpc("respond_friend_request", {
    request_id: String(formData.get("requestId")),
    accept: formData.get("decision") === "accept",
  })
  if (error) throw new Error(error.message)
  revalidatePath("/friends")
}

export async function createStudyRoom(input: { name: string; description: string; goalPeriod: "daily" | "weekly"; goalCount: number; password: string | null }) {
  const { supabase } = await userClient()
  const { error } = await supabase.rpc("create_study_room", {
    room_name: input.name,
    room_description: input.description,
    room_goal_period: input.goalPeriod,
    room_goal_count: input.goalCount,
    room_password: input.password,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/study")
}

export async function addStudyComment(studyId: string, message: string) {
  const { supabase, user } = await userClient()
  const { error } = await supabase.from("study_comments").insert({ study_id: studyId, author_id: user.id, message: message.trim() })
  if (error) throw new Error(error.message)
  revalidatePath(`/study/${studyId}`)
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
