import { ArrowLeft, Crown, Users } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { StudyLounge, type LoungeProfile } from "@/components/study-lounge"
import { StudyProgress } from "@/components/study-progress"
import { JoinStudyRoomButton } from "@/components/join-study-room-button"
import { StudyRoomPasswordForm } from "@/components/study-room-password-form"
import { StudyRoomMembershipActions } from "@/components/study-room-membership-actions"
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

  const progressByUser = new Map<string, number>(
    (detail.progress || []).map((item) => [item.userId, Number(item.solvedCount)]),
  )
  const memberProfiles: Record<string, LoungeProfile | null> = Object.fromEntries(
    (detail.members || []).map((member) => [member.userId, member.profile]),
  )
  const currentProgressMembers = (detail.members || []).map((member) => ({
    userId: member.userId,
    role: member.role,
    profile: member.profile,
    solvedCount: progressByUser.get(member.userId) || 0,
  }))

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
      <Card><CardContent className="flex flex-col gap-5 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h1 className="text-xl font-bold">{room.name}</h1>{room.ownerId === user?.id && <Badge variant="secondary" className="gap-1"><Crown className="size-3" />리더</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{room.description}</p><div className="mt-3 flex gap-2 text-sm"><span className="rounded-lg bg-primary/10 px-2.5 py-1 font-medium text-primary">{room.goalPeriod === "daily" ? "매일" : "매주"} {room.goalCount}문제</span><span className="flex items-center gap-1 text-muted-foreground"><Users className="size-4" />{detail.members.length}명</span></div></div>{!isMember && <JoinStudyRoomButton studyId={id} />}</div></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><StudyProgress studyId={id} goalPeriod={room.goalPeriod} goalCount={room.goalCount} currentMembers={currentProgressMembers} currentPeriod={detail.currentPeriod} canViewProgress={isMember} /></div>
        {isMember ? <StudyLounge studyId={id} currentUserId={user!.id} memberProfiles={memberProfiles} /> : <Card className="h-fit"><CardContent className="p-5 text-center"><p className="text-sm font-medium">스터디 라운지는 멤버 전용입니다.</p><p className="mt-1 text-xs text-muted-foreground">참여하면 멤버들과 메시지를 나눌 수 있어요.</p></CardContent></Card>}
      </div>
    </div>
  )
}
