"use client"

import { LoaderCircle, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { removeFriend } from "@/app/actions"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"

export type FriendCardProfile = {
  id: string
  handle: string
  nickname: string
  avatar_url: string | null
}

export function FriendCard({ friend }: { friend: FriendCardProfile }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const name = friend.nickname || friend.handle

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeFriend(friend.id)
        toast.success(`${name}님을 친구 목록에서 삭제했습니다.`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "친구를 삭제하지 못했습니다.")
      }
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <UserAvatar name={name} imageUrl={friend.avatar_url} className="size-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-primary">@{friend.handle}</p>
      </div>
      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5" aria-live="polite">
          <Button type="button" variant="outline" size="xs" onClick={() => setConfirming(false)} disabled={pending}>취소</Button>
          <Button type="button" variant="destructive" size="xs" onClick={handleRemove} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "삭제 중" : "삭제"}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirming(true)} aria-label={`${name} 친구 삭제`}>
          <Trash2 />
        </Button>
      )}
    </div>
  )
}
