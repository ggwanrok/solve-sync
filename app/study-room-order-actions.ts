"use server"

import { revalidatePath } from "next/cache"
import { normalizeStudyRoomOrder } from "@/lib/study-room-order"
import { getViewer } from "@/lib/server/viewer"

export async function saveStudyRoomOrder(input: unknown) {
  const { supabase, user } = await getViewer()
  if (!user) return { ok: false as const, message: "로그인이 필요합니다." }

  const studyRoomIds = normalizeStudyRoomOrder(input)
  if (!studyRoomIds) return { ok: false as const, message: "스터디룸 배치 정보가 올바르지 않습니다." }

  const { data, error } = await supabase.rpc("reorder_joined_studies", { ordered_study_ids: studyRoomIds })
  if (error) {
    console.error("study room order save failed", { userId: user.id, code: error.code, message: error.message })
    return { ok: false as const, message: "스터디룸 배치를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }
  if (!data) {
    revalidatePath("/study")
    return { ok: false as const, message: "참여 중인 스터디룸이 변경되었습니다. 목록을 확인하고 다시 저장해 주세요." }
  }

  revalidatePath("/study")
  return { ok: true as const }
}
