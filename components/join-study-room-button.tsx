"use client"

import { useActionTransition } from "@/lib/use-pending-action"
import { useRouter } from "next/navigation"
import { LoaderCircle, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { joinStudyRoom } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function JoinStudyRoomButton({ studyId }: { studyId: string }) {
  const [pending, runAction] = useActionTransition()
  const router = useRouter()

  return (
    <>
      {pending && (
        <div role="status" aria-live="polite" className="app-fade-in fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-8 py-6 shadow-lg">
            <LoaderCircle className="size-7 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">스터디룸에 참여하고 있어요</p>
              <p className="mt-1 text-xs text-muted-foreground">멤버 정보를 등록하고 방을 불러오는 중입니다.</p>
            </div>
          </div>
        </div>
      )}
      <Button type="button" className="gap-2" disabled={pending} aria-busy={pending} onClick={() => runAction(async () => {
        try {
          await joinStudyRoom(studyId)
          toast.success("스터디룸에 참여했습니다.")
          router.refresh()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "스터디룸에 참여하지 못했습니다.")
        }
      })}><UserPlus className="size-4" />{pending ? "참여 중..." : "참여하기"}</Button>
    </>
  )
}
