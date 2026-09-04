"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, LoaderCircle, X } from "lucide-react"
import { toast } from "sonner"
import { respondFriendRequest } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { useActionTransition } from "@/lib/use-pending-action"

export function RespondFriendRequestButtons({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [pending, run] = useActionTransition()
  const [decision, setDecision] = useState<"accept" | "decline" | null>(null)
  const [completed, setCompleted] = useState(false)

  function respond(nextDecision: "accept" | "decline") {
    if (completed) return
    run(async () => {
      setDecision(nextDecision)
      try {
        const data = new FormData()
        data.set("requestId", requestId)
        data.set("decision", nextDecision)
        await respondFriendRequest(data)
        setCompleted(true)
        toast.success(nextDecision === "accept" ? "친구 요청을 수락했습니다." : "친구 요청을 거절했습니다.")
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "친구 요청을 처리하지 못했습니다.")
      }
    })
  }

  return (
    <div className="flex gap-1.5" aria-busy={pending}>
      <Button type="button" size="icon-sm" aria-label="친구 요청 수락" disabled={pending || completed} onClick={() => respond("accept")}>
        {pending && decision === "accept" ? <LoaderCircle className="animate-spin" /> : <Check />}
      </Button>
      <Button type="button" size="icon-sm" variant="outline" aria-label="친구 요청 거절" disabled={pending || completed} onClick={() => respond("decline")}>
        {pending && decision === "decline" ? <LoaderCircle className="animate-spin" /> : <X />}
      </Button>
    </div>
  )
}
