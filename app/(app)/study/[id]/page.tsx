import { ArrowLeft, Crown, Users } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { StudyLounge, type LoungeProfile } from "@/components/study-lounge"
import { StudyProgress } from "@/components/study-progress"
import { JoinStudyRoomButton } from "@/components/join-study-room-button"
import { StudyRoomPasswordForm } from "@/components/study-room-password-form"
import { StudyRoomMembershipActions } from "@/components/study-room-membership-actions"
import { StudyRoomMembers, type StudyMemberFriendStatus } from "@/components/study-room-members"
import { StudyNotificationToggle } from "@/components/study-notification-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getViewer } from "@/lib/server/viewer"
import type { StudyRoomDetailData } from "@/lib/study-room-data"

export default async function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await getViewer()
  const { data, error } = await supabase.rpc("study_room_detail", { target_study: id })
  if (error) throw new Error(`스터디룸 정보를 불러오지 못했습니다: ${error.message}`)
  const detail = data as unknown as StudyRoomDetailData
  const room = detail?.room
  if (!room) notFound()
  const isMember = Boolean(detail.isMember)
  const canView = Boolean(detail.canView)

  const otherMemberIds = (detail.members || [])
    .map((member) => member.userId)
    .filter((memberId) => memberId !== user?.id)
  const friendIds = new Set<string>()
  const outgoingRequestIds = new Map<string, string>()
  const incomingRequestIds = new Map<string, string>()
  const notificationSettings = new Map<string, { enabled: boolean; lastPokedAt: string | null }>()

  if (user && otherMemberIds.length > 0) {
    const [friendships, outgoingRequests, incomingRequests] = await Promise.all([
      supabase.from("friendships").select("friend_id").eq("user_id", user.id).in("friend_id", otherMemberIds),
      supabase.from("friend_requests").select("id,receiver_id").eq("sender_id", user.id).eq("status", "pending").in("receiver_id", otherMemberIds),
      supabase.from("friend_requests").select("id,sender_id").eq("receiver_id", user.id).eq("status", "pending").in("sender_id", otherMemberIds),
    ])
    const relationshipError = friendships.error || outgoingRequests.error || incomingRequests.error
    if (relationshipError) throw new Error(`참가자 친구 상태를 불러오지 못했습니다: ${relationshipError.message}`)

    for (const friendship of friendships.data || []) friendIds.add(friendship.friend_id)
    for (const request of outgoingRequests.data || []) outgoingRequestIds.set(request.receiver_id, request.id)
    for (const request of incomingRequests.data || []) incomingRequestIds.set(request.sender_id, request.id)
  }

  if (isMember) {
    const { data: settings, error: settingsError } = await supabase.rpc("study_room_notification_settings", { target_study: id })
    if (settingsError) throw new Error(`스터디 알림 설정을 불러오지 못했습니다: ${settingsError.message}`)
    for (const setting of settings || []) {
      notificationSettings.set(setting.user_id, {
        enabled: Boolean(setting.notifications_enabled),
        lastPokedAt: setting.last_poked_at || null,
      })
    }
  }

  const progressByUser = new Map<string, number>(
    (detail.progress || []).map((item) => [item.userId, Number(item.solvedCount)]),
  )

  const membersWithFriendStatus = (detail.members || []).map((member) => {
    let friendStatus: StudyMemberFriendStatus = "none"
    if (member.userId === user?.id) friendStatus = "self"
    else if (friendIds.has(member.userId)) friendStatus = "friend"
    else if (incomingRequestIds.has(member.userId)) friendStatus = "incoming_pending"
    else if (outgoingRequestIds.has(member.userId)) friendStatus = "outgoing_pending"

    return {
      userId: member.userId,
      role: member.role,
      profile: member.profile,
      friendStatus,
      friendRequestId: incomingRequestIds.get(member.userId),
      notificationsEnabled: notificationSettings.get(member.userId)?.enabled || false,
      lastPokedAt: notificationSettings.get(member.userId)?.lastPokedAt || null,
    }
  })

  const memberProfiles: Record<string, LoungeProfile | null> = Object.fromEntries(
    (detail.members || []).map((member) => [member.userId, member.profile]),
  )
  const currentProgressMembers = (detail.members || []).map((member) => ({
    userId: member.userId,
    role: member.role,
    profile: member.profile,
    solvedCount: progressByUser.get(member.userId) || 0,
  }))
  const currentUserNotificationsEnabled = user ? notificationSettings.get(user.id)?.enabled || false : false

  if (!canView) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Button render={<Link href="/study" />} nativeButton={false} variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground"><ArrowLeft className="size-4" />스터디룸 목록</Button>
        <StudyRoomPasswordForm studyId={id} roomName={room.name} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><Button render={<Link href="/study" />} nativeButton={false} variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground"><ArrowLeft className="size-4" />스터디룸 목록</Button><StudyRoomMembershipActions studyId={id} isOwner={room.ownerId === user?.id} isMember={isMember} /></div>
      <Card><CardContent className="flex flex-col gap-5 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h1 className="text-xl font-bold">{room.name}</h1>{room.ownerId === user?.id && <Badge variant="secondary" className="gap-1"><Crown className="size-3" />리더</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{room.description}</p><div className="mt-3 flex flex-wrap gap-2 text-sm"><span className="rounded-lg bg-primary/10 px-2.5 py-1 font-medium text-primary">{room.goalPeriod === "daily" ? "매일" : "매주"} {room.goalCount}문제</span><span className="rounded-lg bg-muted px-2.5 py-1 font-medium">Lv.{room.minDifficulty} 이상</span><span className="flex items-center gap-1 text-muted-foreground"><Users className="size-4" />{detail.members.length}명</span></div></div><div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">{isMember && <StudyNotificationToggle studyId={id} initialEnabled={currentUserNotificationsEnabled} />}{!isMember && <JoinStudyRoomButton studyId={id} />}</div></div></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><StudyProgress studyId={id} goalPeriod={room.goalPeriod} goalCount={room.goalCount} currentMembers={currentProgressMembers} currentPeriod={detail.currentPeriod} canViewProgress={isMember} /></div>
        <div className="flex flex-col gap-6">
          <StudyRoomMembers studyId={id} members={membersWithFriendStatus} currentUserId={user!.id} isCurrentUserMember={isMember} currentUserNotificationsEnabled={currentUserNotificationsEnabled} />
          {isMember ? <StudyLounge studyId={id} currentUserId={user!.id} memberProfiles={memberProfiles} /> : <Card className="h-fit"><CardContent className="p-5 text-center"><p className="text-sm font-medium">스터디 라운지는 멤버 전용입니다.</p><p className="mt-1 text-xs text-muted-foreground">참여하면 멤버들과 메시지를 나눌 수 있어요.</p></CardContent></Card>}
        </div>
      </div>
    </div>
  )
}
