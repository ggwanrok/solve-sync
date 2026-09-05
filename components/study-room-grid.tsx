"use client"

import { useRef, useState, type PointerEvent } from "react"
import { ArrowLeft, ArrowRight, Crown, GripVertical, LayoutGrid, LoaderCircle, Lock, RotateCcw, Users } from "lucide-react"
import { toast } from "sonner"
import { saveStudyRoomOrder } from "@/app/study-room-order-actions"
import { StudyRoomEntryButton } from "@/components/study-room-entry-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { moveStudyRoom, reconcileStudyRoomOrder } from "@/lib/study-room-order"
import { useActionTransition } from "@/lib/use-pending-action"
import { cn } from "@/lib/utils"

export type StudyRoomDirectoryItem = {
  id: string
  owner_id: string
  name: string
  description: string
  goal_period: "daily" | "weekly"
  goal_count: number
  min_difficulty: number
  is_private: boolean
  created_at: string
  owner_handle: string
  owner_nickname: string
  member_count: number
  is_joined: boolean
}

export function StudyRoomGrid({
  rooms,
  currentUserId,
  joinedRoomIds,
  defaultJoinedRoomIds,
  canReorder = false,
}: {
  rooms: StudyRoomDirectoryItem[]
  currentUserId: string
  joinedRoomIds: string[]
  defaultJoinedRoomIds: string[]
  canReorder?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [savedOrder, setSavedOrder] = useState(joinedRoomIds)
  const [draft, setDraft] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState("")
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const drag = useRef<{ id: string; targetId: string | null; pointerId: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [pending, runSave] = useActionTransition()
  const roomIds = rooms.map((room) => room.id)
  const currentOrder = reconcileStudyRoomOrder(joinedRoomIds, savedOrder)
  const order = reconcileStudyRoomOrder(joinedRoomIds, editing ? draft : currentOrder)
  const positionById = new Map(order.map((id, index) => [id, index]))
  const visibleRooms = canReorder
    ? [...rooms].sort(
        (first, second) => (positionById.get(first.id) ?? roomIds.indexOf(first.id)) - (positionById.get(second.id) ?? roomIds.indexOf(second.id)),
      )
    : rooms
  const visibleIds = visibleRooms.map((room) => room.id)
  const roomById = new Map(rooms.map((room) => [room.id, room]))
  const changed = order.some((id, index) => id !== currentOrder[index])

  function move(id: string, targetId: string) {
    if (pending) return
    const next = moveStudyRoom(order, id, targetId)
    setDraft(next)
    const room = roomById.get(id)
    setAnnouncement(`${room?.name || "스터디룸"}을 ${next.indexOf(id) + 1}번째로 이동했습니다.`)
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (pending || !event.isPrimary || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id, targetId: null, pointerId: event.pointerId }
    setDraggedId(id)
  }

  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const card = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-study-room-id]")
    const targetId = card && gridRef.current?.contains(card) ? card.dataset.studyRoomId || null : null
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
        const result = await saveStudyRoomOrder(order)
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        setSavedOrder(order)
        setEditing(false)
        setAnnouncement("스터디룸 배치를 저장했습니다.")
        toast.success("스터디룸 배치를 저장했습니다.")
      } catch {
        toast.error("스터디룸 배치를 저장하지 못했습니다. 다시 시도해 주세요.")
      }
    })
  }

  return (
    <>
      <p className="sr-only" role="status">{announcement}</p>
      {canReorder && rooms.length > 1 && (
        <div className={cn("flex flex-wrap items-center gap-2", editing ? "justify-between" : "justify-end")}>
          {editing && (
            <p id="study-room-order-help" className="mr-auto text-xs leading-5 text-muted-foreground">
              손잡이를 드래그하거나 화살표로 위치를 바꾸세요. 저장한 배치는 내 계정에만 적용됩니다.
            </p>
          )}
          {editing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending || !!draggedId}
                onClick={() => {
                  setDraft(reconcileStudyRoomOrder(joinedRoomIds, defaultJoinedRoomIds))
                  setAnnouncement("스터디룸 배치를 기본 순서로 되돌렸습니다. 저장하면 적용됩니다.")
                }}
              >
                <RotateCcw />초기화
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setEditing(false); setAnnouncement("배치 편집을 취소했습니다.") }}>취소</Button>
              <Button type="button" size="sm" disabled={pending || !changed || !!draggedId} aria-busy={pending} onClick={save}>
                {pending && <LoaderCircle className="animate-spin" />}
                {pending ? "저장 중…" : "배치 저장"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => { setDraft(currentOrder); setEditing(true); setAnnouncement("") }}>
              <LayoutGrid />배치 편집
            </Button>
          )}
        </div>
      )}

      <div ref={gridRef} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={editing ? "스터디룸 배치 편집" : undefined} aria-describedby={editing ? "study-room-order-help" : undefined} aria-busy={pending}>
        {visibleRooms.map((room, index) => {
          const leader = room.owner_id === currentUserId
          const joined = room.is_joined
          const ownerName = room.owner_nickname || room.owner_handle || "방장"
          const previousId = visibleIds[index - 1]
          const nextId = visibleIds[index + 1]
          return (
            <Card
              key={room.id}
              data-study-room-id={room.id}
              className={cn(
                "group py-0 transition-all duration-200",
                editing ? "border-dashed" : "hover:shadow-[0_14px_36px_rgba(15,23,42,0.075)]",
                draggedId === room.id && "scale-[0.98] opacity-50",
                dropTarget === room.id && draggedId !== room.id && "border-ring bg-muted/30 ring-2 ring-ring/20",
              )}
            >
              <CardContent className="flex h-full flex-col gap-5 p-5 sm:p-6">
                {editing && (
                  <div className="flex items-center gap-2 border-b pb-3">
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`${room.name} 위치 이동`}
                      aria-describedby="study-room-order-help"
                      className="flex size-9 shrink-0 touch-none items-center justify-center rounded-lg text-muted-foreground outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring enabled:cursor-grab enabled:active:cursor-grabbing disabled:opacity-50"
                      onPointerDown={(event) => startDrag(event, room.id)}
                      onPointerMove={updateDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={(event) => endDrag(event, true)}
                      onLostPointerCapture={(event) => endDrag(event, true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && drag.current) { drag.current = null; setDraggedId(null); setDropTarget(null); return }
                        const target = event.key === "ArrowLeft" || event.key === "ArrowUp" ? previousId : event.key === "ArrowRight" || event.key === "ArrowDown" ? nextId : null
                        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) event.preventDefault()
                        if (target) move(room.id, target)
                      }}
                    >
                      <GripVertical className="size-4" aria-hidden="true" />
                    </button>
                    <Badge variant="secondary" className="tabular-nums">{index + 1}</Badge>
                    <span className="ml-auto flex gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${room.name} 앞으로 이동`} disabled={pending || index === 0 || !!draggedId} onClick={() => move(room.id, previousId)}><ArrowLeft /></Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${room.name} 뒤로 이동`} disabled={pending || index === visibleRooms.length - 1 || !!draggedId} onClick={() => move(room.id, nextId)}><ArrowRight /></Button>
                    </span>
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold tracking-tight">{room.name}</h2>
                    {room.is_private && <Lock className="size-3.5 text-muted-foreground" />}
                    {leader && <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-xs"><Crown className="size-3 text-warning-foreground" />리더</Badge>}
                    {!leader && joined && <Badge variant="secondary" className="px-1.5 py-0 text-xs">참여 중</Badge>}
                  </div>
                  <p className="mt-1 h-10 line-clamp-2 text-sm text-muted-foreground">{room.description || <span className="sr-only">소개 없음</span>}</p>
                  <p className="mt-2 text-xs text-muted-foreground">방장 · {ownerName}</p>
                </div>
                <div className="rounded-xl bg-muted/65 px-3.5 py-3 text-sm">
                  <span className="text-muted-foreground">규칙 · </span>
                  <span className="font-medium">{room.goal_period === "daily" ? "매일" : "매주"} {room.goal_count}문제 · Lv.{room.min_difficulty} 이상</span>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" />{room.member_count}명</span>
                  {!editing && <StudyRoomEntryButton studyId={room.id} joined={joined} />}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
