"use client"

import { useRef, useState, type PointerEvent } from "react"
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { saveFriendOrder } from "@/app/friend-order-actions"
import { FriendCard, type FriendCardProfile } from "@/components/friend-card"
import type { ContributionDay } from "@/components/contribution-graph"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { moveFriend, reconcileFriendOrder } from "@/lib/friend-order"
import { useActionTransition } from "@/lib/use-pending-action"
import { cn } from "@/lib/utils"

type FriendListEntry = { profile: FriendCardProfile; contributions: ContributionDay[] }

export function FriendList({ friends, canReorder = true, loadError = false }: {
  friends: FriendListEntry[]
  canReorder?: boolean
  loadError?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState("")
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const drag = useRef<{ id: string; targetId: string | null; pointerId: number } | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [pending, runSave] = useActionTransition()
  const friendIds = friends.map(({ profile }) => profile.id)
  const order = reconcileFriendOrder(friendIds, editing ? draft : [])
  const byId = new Map(friends.map((friend) => [friend.profile.id, friend]))
  const changed = order.some((id, index) => id !== friendIds[index])

  function move(id: string, targetId: string) {
    if (pending) return
    const next = moveFriend(order, id, targetId)
    setDraft(next)
    const profile = byId.get(id)?.profile
    setAnnouncement(`${profile?.nickname || profile?.handle || "친구"}님을 ${next.indexOf(id) + 1}번째로 이동했습니다.`)
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (pending || !event.isPrimary || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id, targetId: null, pointerId: event.pointerId }
    setDraggedId(id)
  }

  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-friend-id]")
    const targetId = row && listRef.current?.contains(row) ? row.dataset.friendId || null : null
    drag.current.targetId = targetId
    setDropTarget(targetId)
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = drag.current
    if (!active || active.pointerId !== event.pointerId) return
    if (!cancelled) updateDrag(event)
    drag.current = null
    setDraggedId(null)
    setDropTarget(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!cancelled && active.targetId && active.targetId !== active.id) move(active.id, active.targetId)
  }

  function save() {
    runSave(async () => {
      try {
        const result = await saveFriendOrder(order)
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        setEditing(false)
        setAnnouncement("친구 순서를 저장했습니다.")
        toast.success("친구 순서를 저장했습니다.")
      } catch {
        toast.error("친구 순서를 저장하지 못했습니다. 다시 시도해 주세요.")
      }
    })
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle>내 친구</CardTitle>
          <Badge variant="secondary">{friends.length}명</Badge>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setEditing(false); setAnnouncement("순서 편집을 취소했습니다.") }}>취소</Button>
            <Button type="button" size="sm" disabled={pending || !changed || !!draggedId || !canReorder} aria-busy={pending} onClick={save}>
              {pending && <LoaderCircle className="animate-spin" />}
              {pending ? "저장 중…" : "순서 저장"}
            </Button>
          </div>
        ) : friends.length > 1 && canReorder ? (
          <Button type="button" variant="outline" size="sm" onClick={() => { setDraft(friendIds); setEditing(true); setAnnouncement("") }}><ListOrdered />순서 편집</Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="sr-only" role="status">{announcement}</p>
        {loadError ? (
          <p role="alert" className="py-12 text-center text-sm text-muted-foreground">친구 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>
        ) : !friends.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">아직 친구가 없어요. @아이디로 첫 친구를 추가해보세요.</p>
        ) : editing ? (
          <>
            <p id="friend-order-help" className="mb-4 text-xs leading-5 text-muted-foreground">왼쪽 손잡이를 드래그하거나 화살표 버튼으로 순서를 바꾸세요. 저장한 순서는 내 계정에만 적용됩니다.</p>
            <ol ref={listRef} className="space-y-2" aria-label="친구 순서 편집" aria-describedby="friend-order-help" aria-busy={pending}>
              {order.map((id, index) => {
                const { profile } = byId.get(id)!
                const name = profile.nickname || profile.handle
                return (
                  <li key={id} data-friend-id={id} className={cn("flex items-center gap-2 rounded-xl border border-transparent bg-muted/45 p-2 transition-colors", draggedId === id && "opacity-50", dropTarget === id && draggedId !== id && "border-ring bg-muted")}>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`${name} 순서 이동`}
                      aria-describedby="friend-order-help"
                      className="flex size-9 shrink-0 touch-none items-center justify-center rounded-lg text-muted-foreground outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring enabled:cursor-grab enabled:active:cursor-grabbing disabled:opacity-50"
                      onPointerDown={(event) => startDrag(event, id)}
                      onPointerMove={updateDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={(event) => endDrag(event, true)}
                      onLostPointerCapture={(event) => endDrag(event, true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && drag.current) { drag.current = null; setDraggedId(null); setDropTarget(null); return }
                        const target = event.key === "ArrowUp" ? order[index - 1] : event.key === "ArrowDown" ? order[index + 1] : null
                        if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault()
                        if (target) move(id, target)
                      }}
                    ><GripVertical className="size-4" aria-hidden="true" /></button>
                    <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    <UserAvatar name={name} imageUrl={profile.avatar_url} className="hidden size-9 shrink-0 sm:flex" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{profile.handle}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${name} 앞으로 이동`} disabled={pending || index === 0 || !!draggedId} onClick={() => move(id, order[index - 1])}><ArrowUp /></Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${name} 뒤로 이동`} disabled={pending || index === order.length - 1 || !!draggedId} onClick={() => move(id, order[index + 1])}><ArrowDown /></Button>
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {friends.map(({ profile, contributions }) => <FriendCard key={profile.id} friend={profile} contributions={contributions} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
