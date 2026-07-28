"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteStudyRoom, leaveStudyRoom } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function StudyRoomMembershipActions({ studyId, isOwner, isMember }: { studyId: string; isOwner: boolean; isMember: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  if (!isOwner && !isMember) return null

  const label = isOwner ? "스터디룸 삭제" : "방 나가기"
  const description = isOwner
    ? "방과 라운지 메시지 등 모든 스터디 데이터가 삭제되며 복구할 수 없습니다."
    : "방을 나가면 스터디 라운지에 더 이상 접근할 수 없습니다."

  async function execute() {
    setPending(true)
    try {
      if (isOwner) await deleteStudyRoom(studyId)
      else await leaveStudyRoom(studyId)
      toast.success(isOwner ? "스터디룸을 삭제했습니다." : "스터디룸에서 나왔습니다.")
      router.push("/study")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${label} 처리에 실패했습니다.`)
      setPending(false)
    }
  }

  if (!confirming) {
    return <Button type="button" variant={isOwner ? "destructive" : "outline"} size="sm" className="gap-1.5" onClick={() => setConfirming(true)}>{isOwner ? <Trash2 className="size-4" /> : <LogOut className="size-4" />}{label}</Button>
  }

  return (
    <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-3 sm:w-auto sm:min-w-80">
      <p className="text-xs leading-relaxed text-destructive">{description}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>취소</Button>
        <Button type="button" variant="destructive" size="sm" onClick={execute} disabled={pending}>{pending ? "처리 중..." : label}</Button>
      </div>
    </div>
  )
}
