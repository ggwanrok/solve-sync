"use server"

import { revalidatePath } from "next/cache"
import { getViewer } from "@/lib/server/viewer"
import { normalizeFriendOrder } from "@/lib/friend-order"

export async function saveFriendOrder(input: unknown) {
  const { supabase, user } = await getViewer()
  if (!user) return { ok: false as const, message: "로그인이 필요합니다." }
  const friendIds = normalizeFriendOrder(input)
  if (!friendIds) return { ok: false as const, message: "친구 순서 정보가 올바르지 않습니다." }

  const { data, error } = await supabase.rpc("reorder_friends", { ordered_friend_ids: friendIds })
  if (error) {
    console.error("friend order save failed", { userId: user.id, code: error.code, message: error.message })
    return { ok: false as const, message: "친구 순서를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }
  }
  if (!data) {
    revalidatePath("/friends")
    return { ok: false as const, message: "친구 목록이 변경되었습니다. 목록을 확인하고 다시 저장해 주세요." }
  }

  revalidatePath("/friends")
  return { ok: true as const }
}
