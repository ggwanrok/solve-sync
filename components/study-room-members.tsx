"use client"

import { useState } from "react"
import { Crown, LoaderCircle, UserCheck, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { respondFriendRequest, sendFriendRequest } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import type { StudyRoomProfile } from "@/lib/study-room-data"

export type StudyMemberFriendStatus = "self" | "friend" | "none" | "outgoing_pending" | "incoming_pending"

export type StudyRoomMemberWithFriendStatus = {
  userId: string
  role: string
  profile: StudyRoomProfile | null
  friendStatus: StudyMemberFriendStatus
  friendRequestId?: string
}

function memberName(profile: StudyRoomProfile | null) {
  return profile?.nickname || profile?.handle || "멤버"
}

export function StudyRoomMembers({
  studyId,
  members,
}: {
  studyId: string
  members: StudyRoomMemberWithFriendStatus[]
}) {
  const router = useRouter()
  const [statuses, setStatuses] = useState<Record<string, StudyMemberFriendStatus>>(
    Object.fromEntries(members.map((member) => [member.userId, member.friendStatus])),
  )
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)

  async function requestFriend(member: StudyRoomMemberWithFriendStatus) {
    if (!member.profile?.handle) return
    setPendingMemberId(member.userId)

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
      setPendingMemberId(null)
    }
  }

  async function acceptFriend(member: StudyRoomMemberWithFriendStatus) {
    if (!member.friendRequestId) return
    setPendingMemberId(member.userId)

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
      setPendingMemberId(null)
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
            const status = statuses[member.userId]
            const pending = pendingMemberId === member.userId

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
                <div className="shrink-0" aria-live="polite">
                  {status === "self" && <Badge variant="secondary">나</Badge>}
                  {status === "friend" && <Badge variant="outline" className="gap-1 text-primary"><UserCheck className="size-3" />친구</Badge>}
                  {status === "outgoing_pending" && <Badge variant="secondary">요청 보냄</Badge>}
                  {status === "incoming_pending" && (
                    <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => acceptFriend(member)}>
                      {pending ? <LoaderCircle className="animate-spin" /> : <UserCheck />}
                      {pending ? "수락 중" : "친구 수락"}
                    </Button>
                  )}
                  {status === "none" && (
                    <Button type="button" size="xs" variant="outline" disabled={pending || !member.profile?.handle} onClick={() => requestFriend(member)}>
                      {pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
                      {pending ? "요청 중" : "친구 신청"}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
