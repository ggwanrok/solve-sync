"use client"

import { useState } from "react"
import { Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { sendFriendRequest } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function FriendRequestForm() {
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)

    try {
      const form = event.currentTarget
      const result = await sendFriendRequest(new FormData(form))

      if (result.status === "sent") {
        form.reset()
        toast.success(result.message)
      } else if (["already_sent", "incoming_pending", "already_friends"].includes(result.status)) {
        toast.info(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "친구 요청을 보내지 못했습니다.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="handle" placeholder="@아이디로 친구 검색" className="pl-9" disabled={pending} required />
      </div>
      <Button type="submit" className="gap-2" disabled={pending}>
        <UserPlus className="size-4" />
        {pending ? "요청 중..." : "친구 추가"}
      </Button>
    </form>
  )
}
