"use client"

import { ChevronRight, LoaderCircle, Sprout, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { removeFriend } from "@/app/actions"
import { ContributionGraph, type ContributionDay } from "@/components/contribution-graph"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export type FriendCardProfile = {
  id: string
  handle: string
  nickname: string
  avatar_url: string | null
}

export function FriendCard({ friend, contributions }: { friend: FriendCardProfile; contributions: ContributionDay[] }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const name = friend.nickname || friend.handle
  const activeDays = contributions.filter((day) => day.problems.length > 0).length
  const solvedCount = contributions.reduce((total, day) => total + day.problems.length, 0)

  function handleRemove() {
    startTransition(async () => {
      try {
        const result = await removeFriend(friend.id)
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        toast.success(`${name}님을 친구 목록에서 삭제했습니다.`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "친구를 삭제하지 못했습니다.")
      }
    })
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border p-2 transition-colors hover:border-primary/30">
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setConfirming(false)}
            />
          }
        >
          <UserAvatar name={name} imageUrl={friend.avatar_url} className="size-11" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-primary">@{friend.handle}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DialogTrigger>

        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{name} 친구 자세히 보기</DialogTitle>
            <DialogDescription>{name}님의 프로필과 최근 잔디 현황입니다.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center rounded-xl bg-accent/35 px-5 py-6 text-center sm:flex-row sm:text-left">
            <UserAvatar name={name} imageUrl={friend.avatar_url} className="size-24 ring-4 ring-background" />
            <div className="mt-4 min-w-0 sm:ml-5 sm:mt-0">
              <p className="text-xs font-medium text-muted-foreground">표시 이름</p>
              <p className="mt-1 truncate text-2xl font-bold tracking-tight">{name}</p>
              <p className="mt-0.5 truncate text-sm text-primary">@{friend.handle}</p>
              <Badge variant="secondary" className="mt-3">친구</Badge>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <Sprout className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">잔디 현황</p>
                  <p className="text-xs text-muted-foreground">최근 16주 학습 강도</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                활동 <span className="font-medium text-foreground">{activeDays}일</span>
                <span aria-hidden="true"> · </span>
                풀이 <span className="font-medium text-foreground">{solvedCount}문제</span>
              </p>
            </div>
            <ContributionGraph data={contributions} />
          </div>
        </DialogContent>
      </Dialog>

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
