"use server"

import { revalidatePath } from "next/cache"
import { getViewer } from "@/lib/server/viewer"
import { normalizeStudyRoomSettings } from "@/lib/study-room-settings"

export async function updateStudyRoomSettings(input: unknown) {
  const { supabase, user } = await getViewer()
  if (!user) return { ok: false as const, message: "로그인이 필요합니다." }

  const settings = normalizeStudyRoomSettings(input)
  if (!settings) return { ok: false as const, message: "스터디룸 설정을 확인해 주세요." }

  const { error } = await supabase.rpc("update_study_room", {
    target_study: settings.studyId,
    room_name: settings.name,
    room_description: settings.description,
    room_is_private: settings.isPrivate,
    room_password: settings.password,
  })
  if (error) {
    console.error("study room settings update failed", { userId: user.id, studyId: settings.studyId, code: error.code, message: error.message })
    return { ok: false as const, message: error.message || "스터디룸 설정을 저장하지 못했습니다." }
  }

  revalidatePath("/study")
  revalidatePath(`/study/${settings.studyId}`)
  return { ok: true as const }
}
