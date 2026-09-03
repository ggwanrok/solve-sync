"use client"

import { LoaderCircle, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { cancelFriendRequest } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function CancelFriendRequestButton({ requestId, memberName }: { requestId: string; memberName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function cancelRequest() {
    startTransition(async () => {
      try {
        const result = await cancelFriendRequest(requestId)
        if (!result.ok) {
          toast.error(result.message)
          router.refresh()
          return
        }
        toast.success(`${memberName}님에게 보낸 친구 요청을 취소했습니다.`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "친구 요청을 취소하지 못했습니다.")
      }
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-muted-foreground hover:text-destructive"
      onClick={cancelRequest}
      disabled={pending}
      aria-label={`${memberName}님에게 보낸 친구 요청 취소`}
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <X />}
      {pending ? "취소 중" : "취소"}
    </Button>
  )
}
