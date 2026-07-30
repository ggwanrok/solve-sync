import { ArrowLeft, Crown, Users } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { StudyLounge, type LoungeComment, type LoungeProfile } from "@/components/study-lounge"
import { StudyProgress, type StudyProgressHistoryEntry } from "@/components/study-progress"
import { JoinStudyRoomButton } from "@/components/join-study-room-button"
import { StudyRoomPasswordForm } from "@/components/study-room-password-form"
import { StudyRoomMembershipActions } from "@/components/study-room-membership-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getViewer } from "@/lib/server/viewer"

type Profile = LoungeProfile

export default async function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await getViewer()
  const [{ data: room }, { data: members }, { data: comments }] = await Promise.all([
    supabase.from("study_rooms").select("id,owner_id,name,description,goal_period,goal_count,is_private").eq("id", id).maybeSingle(),
    supabase.from("study_members").select("user_id,role,joined_at,profile:profiles!study_members_user_id_fkey(handle,nickname,avatar_url)").eq("study_id", id),
    supabase.from("study_comments").select("id,study_id,author_id,message,created_at,profile:profiles!study_comments_author_id_fkey(handle,nickname,avatar_url)").eq("study_id", id).order("created_at"),
  ])
  if (!room) notFound()
  const isMember = Boolean(user && (members || []).some((member) => member.user_id === user.id))
  let canView = !room.is_private || isMember
  if (!canView) {
    const { data } = await supabase.rpc("has_study_room_access", { target_study: id })
    canView = Boolean(data)
  }
  const [{ data: progressData }, { data: historyData }] = isMember
    ? await Promise.all([
      supabase.rpc("study_member_goal_progress", { target_study: id }),
      supabase.rpc("study_goal_history", { target_study: id }),
    ])
    : [{ data: [] }, { data: [] }]
  const progressByUser = new Map<string, number>((progressData || []).map((item: { user_id: string; solved_count: number }) => [item.user_id, Number(item.solved_count)]))
  const memberProfiles: Record<string, LoungeProfile | null> = Object.fromEntries(
    (members || []).map((member) => [member.user_id, member.profile as unknown as LoungeProfile | null]),
  )
  const progressTarget = room.goal_count
  const currentProgressMembers = (members || []).map((member) => ({
    userId: member.user_id,
    role: member.role,
    profile: member.profile as unknown as Profile | null,
    solvedCount: progressByUser.get(member.user_id) || 0,
  }))
  const progressHistory: StudyProgressHistoryEntry[] = (historyData || []).map((entry: {
    period_start: string
    period_end: string
    period_number: number
    user_id: string
    role: string
    handle: string
    nickname: string
    avatar_url: string | null
    solved_count: number
  }) => ({
    periodStart: entry.period_start,
    periodEnd: entry.period_end,
    periodNumber: Number(entry.period_number),
    userId: entry.user_id,
    role: entry.role,
    profile: { handle: entry.handle, nickname: entry.nickname, avatar_url: entry.avatar_url },
    solvedCount: Number(entry.solved_count),
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><Button render={<Link href="/study" />} nativeButton={false} variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground"><ArrowLeft className="size-4" />스터디룸 목록</Button><StudyRoomMembershipActions studyId={id} isOwner={room.owner_id === user?.id} isMember={isMember} /></div>
      <Card><CardContent className="flex flex-col gap-5 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h1 className="text-xl font-bold">{room.name}</h1>{room.owner_id === user?.id && <Badge variant="secondary" className="gap-1"><Crown className="size-3" />리더</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{room.description}</p><div className="mt-3 flex gap-2 text-sm"><span className="rounded-lg bg-primary/10 px-2.5 py-1 font-medium text-primary">{room.goal_period === "daily" ? "매일" : "매주"} {room.goal_count}문제</span><span className="flex items-center gap-1 text-muted-foreground"><Users className="size-4" />{members?.length || 0}명</span></div></div>{!isMember && <JoinStudyRoomButton studyId={id} />}</div></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><StudyProgress goalPeriod={room.goal_period} goalCount={progressTarget} currentMembers={currentProgressMembers} history={progressHistory} canViewProgress={isMember} /></div>
        {isMember ? <StudyLounge studyId={id} currentUserId={user!.id} initialComments={(comments || []) as unknown as LoungeComment[]} memberProfiles={memberProfiles} /> : <Card className="h-fit"><CardContent className="p-5 text-center"><p className="text-sm font-medium">스터디 라운지는 멤버 전용입니다.</p><p className="mt-1 text-xs text-muted-foreground">참여하면 멤버들과 메시지를 나눌 수 있어요.</p></CardContent></Card>}
      </div>
    </div>
  )
}
