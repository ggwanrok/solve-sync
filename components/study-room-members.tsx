"use client"

import { useEffect, useState } from "react"
import { BellRing, Crown, LoaderCircle, UserCheck, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { respondFriendRequest, sendFriendRequest } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import { usePendingActions } from "@/lib/use-pending-action"
import { nextPokeExpiration, pokeExpiresAt, POKE_COOLDOWN_MS } from "@/lib/study-poke"
import type { StudyRoomProfile } from "@/lib/study-room-data"

export type StudyMemberFriendStatus = "self" | "friend" | "none" | "outgoing_pending" | "incoming_pending"

export type StudyRoomMemberWithFriendStatus = {
  userId: string
  role: string
  profile: StudyRoomProfile | null
  friendStatus: StudyMemberFriendStatus
  friendRequestId?: string
  notificationsEnabled: boolean
  lastPokedAt: string | null
}

function memberName(profile: StudyRoomProfile | null) {
  return profile?.nickname || profile?.handle || "멤버"
}

export function StudyRoomMembers({
  studyId,
  members,
  currentUserId,
  isCurrentUserMember,
  currentUserNotificationsEnabled,
}: {
  studyId: string
  members: StudyRoomMemberWithFriendStatus[]
  currentUserId: string
  isCurrentUserMember: boolean
  currentUserNotificationsEnabled: boolean
}) {
  const router = useRouter()
  const [statuses, setStatuses] = useState<Record<string, StudyMemberFriendStatus>>({})
  const [previousMembers, setPreviousMembers] = useState(members)
  if (previousMembers !== members) {
    const previous = new Map(previousMembers.map((member) => [member.userId, member]))
    const unchanged = new Set(members.filter((member) => {
      const old = previous.get(member.userId)
      return old?.friendStatus === member.friendStatus && old?.friendRequestId === member.friendRequestId
    }).map((member) => member.userId))
    setPreviousMembers(members)
    setStatuses((current) => Object.fromEntries(Object.entries(current).filter(([id]) => unchanged.has(id))))
  }
  const actions = usePendingActions()
  const [pokeExpirations, setPokeExpirations] = useState<Record<string, number>>({})
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const updateClock = () => setNow(Date.now())
    const nextExpiration = nextPokeExpiration(
      members.map((member) => pokeExpiresAt(member.lastPokedAt, pokeExpirations[member.userId])),
      now,
    )
    const timeout = nextExpiration == null ? undefined : window.setTimeout(updateClock, Math.max(0, nextExpiration - Date.now()) + 50)
    window.addEventListener("focus", updateClock)
    document.addEventListener("visibilitychange", updateClock)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener("focus", updateClock)
      document.removeEventListener("visibilitychange", updateClock)
    }
  }, [members, pokeExpirations, now])

  async function requestFriend(member: StudyRoomMemberWithFriendStatus) {
    if (!member.profile?.handle || !actions.start(`friend:${member.userId}`)) return

    try {
      const formData = new FormData()
      formData.set("handle", member.profile.handle)
      formData.set("studyId", studyId)
      const result = await sendFriendRequest(formData)

      if (result.status === "sent") {
        setStatuses((current) => ({ ...current, [member.userId]: "outgoing_pending" }))
        toast.success(result.message)
        router.refresh()
      } else if (result.status === "already_sent") {
        setStatuses((current) => ({ ...current, [member.userId]: "outgoing_pending" }))
        toast.info(result.message)
      } else if (result.status === "already_friends") {
        setStatuses((current) => ({ ...current, [member.userId]: "friend" }))
        toast.info(result.message)
        router.refresh()
      } else if (result.status === "incoming_pending") {
        toast.info(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "친구 요청을 보내지 못했습니다.")
    } finally {
      actions.finish(`friend:${member.userId}`)
    }
  }

  async function acceptFriend(member: StudyRoomMemberWithFriendStatus) {
    if (!member.friendRequestId || !actions.start(`friend:${member.userId}`)) return

    try {
      const formData = new FormData()
      formData.set("requestId", member.friendRequestId)
      formData.set("decision", "accept")
      formData.set("studyId", studyId)
      await respondFriendRequest(formData)
      setStatuses((current) => ({ ...current, [member.userId]: "friend" }))
      toast.success(`${memberName(member.profile)}님과 친구가 되었습니다.`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "친구 요청을 수락하지 못했습니다.")
    } finally {
      actions.finish(`friend:${member.userId}`)
    }
  }

  async function pokeMember(member: StudyRoomMemberWithFriendStatus) {
    if (!isCurrentUserMember || member.userId === currentUserId
      || !currentUserNotificationsEnabled || !member.notificationsEnabled
      || pokeExpiresAt(member.lastPokedAt, pokeExpirations[member.userId]) > Date.now()
      || !actions.start(`poke:${member.userId}`)) return
    try {
      const response = await authenticatedFetch(`/api/studies/${studyId}/members/${member.userId}/poke`, { method: "POST" })
      const result = await response.json() as { error?: string }
      if (!response.ok) return toast.error(result.error || "콕 찌르기 알림을 보내지 못했습니다.")

      setPokeExpirations((current) => ({ ...current, [member.userId]: Date.now() + POKE_COOLDOWN_MS }))
      toast.success(`${memberName(member.profile)}님을 콕 찔렀어요.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "콕 찌르기 알림을 보내지 못했습니다.")
    } finally {
      actions.finish(`poke:${member.userId}`)
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>참가 인원</CardTitle>
        <CardAction><Badge variant="secondary">{members.length}명</Badge></CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="max-h-80 divide-y overflow-y-auto">
          {members.map((member) => {
            const name = memberName(member.profile)
            const status = statuses[member.userId] || member.friendStatus
            const friendPending = actions.keys.has(`friend:${member.userId}`)
            const pokePending = actions.keys.has(`poke:${member.userId}`)
            const pokedRecently = pokeExpiresAt(member.lastPokedAt, pokeExpirations[member.userId]) > now
            const showPoke = isCurrentUserMember && member.userId !== currentUserId
            const canPoke = currentUserNotificationsEnabled
              && member.notificationsEnabled
            const pokeLabel = pokePending
              ? "전송 중"
              : pokedRecently
                ? "콕 완료"
                : !currentUserNotificationsEnabled || !member.notificationsEnabled
                  ? "알림 꺼짐"
                  : "콕 찌르기"
            const pokeDisabledReason = !currentUserNotificationsEnabled
              ? "내 스터디 알림을 켜면 콕 찌르기를 보낼 수 있어요."
              : !member.notificationsEnabled
                ? "상대방이 이 스터디의 알림을 켜야 해요."
                : pokedRecently
                  ? "같은 멤버는 10분에 한 번만 콕 찌를 수 있어요."
                  : undefined

            return (
              <li key={member.userId} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar name={name} imageUrl={member.profile?.avatar_url} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{name}</p>
                    {member.role === "leader" && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <Crown className="size-3" aria-hidden="true" />리더
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{member.profile?.handle && `@${member.profile.handle}`}</p>
                </div>
                <div className="grid h-13 shrink-0 grid-rows-2 justify-items-end gap-1" aria-live="polite">
                  <div className="flex h-6 items-center">
                    {status === "self" && <Badge variant="secondary">나</Badge>}
                    {status === "friend" && <Badge variant="outline" className="gap-1 text-primary"><UserCheck className="size-3" />친구</Badge>}
                    {status === "outgoing_pending" && <Badge variant="secondary">요청 보냄</Badge>}
                    {status === "incoming_pending" && (
                      <Button type="button" size="xs" variant="outline" disabled={friendPending} aria-busy={friendPending} onClick={() => acceptFriend(member)}>
                        {friendPending ? <LoaderCircle className="animate-spin" /> : <UserCheck />}
                        {friendPending ? "수락 중" : "친구 수락"}
                      </Button>
                    )}
                    {status === "none" && (
                      <Button type="button" size="xs" variant="outline" disabled={friendPending || !member.profile?.handle} aria-busy={friendPending} onClick={() => requestFriend(member)}>
                        {friendPending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
                        {friendPending ? "요청 중" : "친구 신청"}
                      </Button>
                    )}
                  </div>
                  <div className="flex h-6 items-center">
                    {showPoke && (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        disabled={pokePending || pokedRecently || !canPoke}
                        aria-busy={pokePending}
                        title={pokeDisabledReason}
                        onClick={() => pokeMember(member)}
                      >
                        {pokePending ? <LoaderCircle className="animate-spin" /> : <BellRing />}
                        {pokeLabel}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
