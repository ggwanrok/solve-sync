"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import { toast } from "sonner"
import { joinStudyRoom } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function JoinStudyRoomButton({ studyId }: { studyId: string }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()

  return <Button type="button" className="gap-2" disabled={pending} onClick={async () => {
    setPending(true)
    try {
      await joinStudyRoom(studyId)
      toast.success("스터디룸에 참여했습니다.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스터디룸에 참여하지 못했습니다.")
    } finally {
      setPending(false)
    }
  }}><UserPlus className="size-4" />{pending ? "참여 중..." : "참여하기"}</Button>
}
