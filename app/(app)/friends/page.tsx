import { Clock3 } from "lucide-react"
import { RespondFriendRequestButtons } from "@/components/respond-friend-request-buttons"
import { CancelFriendRequestButton } from "@/components/cancel-friend-request-button"
import type { ContributionDay } from "@/components/contribution-graph"
import { FriendCard, type FriendCardProfile } from "@/components/friend-card"
import { FriendRequestForm } from "@/components/friend-request-form"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { redirect } from "next/navigation"
import { addCalendarDays, dayKey } from "@/lib/calendar"
import { getViewer } from "@/lib/server/viewer"

type Profile = FriendCardProfile
type FriendContributionEvent = {
  friend_id: string
  title: string
  language: string | null
  difficulty: number | null
  accepted_at: string
  problem_id: string
}

export default async function FriendsPage() {
  const { supabase, user } = await getViewer()
  if (!user) redirect("/login")
  const today = dayKey(new Date())
  const firstDate = addCalendarDays(today, -111)
  const [
    { data: relations },
    { data: incoming },
    { data: outgoing },
    { data: contributionData, error: contributionError },
  ] = await Promise.all([
    supabase.from("friendships").select("friend_id, friend:profiles!friendships_friend_id_fkey(id,handle,nickname,bio,avatar_url)").eq("user_id", user.id),
    supabase.from("friend_requests").select("id, sender:profiles!friend_requests_sender_id_fkey(id,handle,nickname,avatar_url)").eq("receiver_id", user.id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("friend_requests").select("id, receiver:profiles!friend_requests_receiver_id_fkey(id,handle,nickname,avatar_url)").eq("sender_id", user.id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.rpc("friend_contribution_events", { first_date: firstDate }),
  ])
  const friends = (relations || []).map((row) => row.friend as unknown as Profile).filter(Boolean)
  const receivedRequests = (incoming || []).map((row) => ({ id: row.id, profile: row.sender as unknown as Profile })).filter((row) => row.profile)
  const sentRequests = (outgoing || []).map((row) => ({ id: row.id, profile: row.receiver as unknown as Profile })).filter((row) => row.profile)
  if (contributionError) console.error("friend contribution lookup failed", contributionError)

  const problemsByFriend = new Map<string, Map<string, ContributionDay["problems"]>>()
  const contributionEvents = (contributionData || []) as FriendContributionEvent[]
  contributionEvents.forEach((event) => {
    const date = dayKey(new Date(event.accepted_at))
    const problemsByDay = problemsByFriend.get(event.friend_id) || new Map<string, ContributionDay["problems"]>()
    const problems = problemsByDay.get(date) || []
    problems.push({
      title: event.title || `문제 ${event.problem_id}`,
      language: event.language,
      difficulty: event.difficulty,
    })
    problemsByDay.set(date, problems)
    problemsByFriend.set(event.friend_id, problemsByDay)
  })

  const contributionsByFriend = new Map<string, ContributionDay[]>()
  friends.forEach((friend) => {
    const days: ContributionDay[] = []
    const problemsByDay = problemsByFriend.get(friend.id)
    let date = firstDate
    while (date <= today) {
      days.push({ date, problems: problemsByDay?.get(date) || [] })
      date = addCalendarDays(date, 1)
    }
    contributionsByFriend.set(friend.id, days)
  })

  return (
    <div className="page-container">
      <div><h1 className="page-heading">친구</h1><p className="page-description">@아이디로 친구를 찾고 함께 성장하세요.</p></div>
      <FriendRequestForm />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">내 친구</CardTitle><Badge variant="secondary">{friends.length}명</Badge></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {friends.length ? friends.map((friend) => <FriendCard key={friend.id} friend={friend} contributions={contributionsByFriend.get(friend.id) || []} />) : <p className="col-span-full py-12 text-center text-sm text-muted-foreground">아직 친구가 없어요. @아이디로 첫 친구를 추가해보세요.</p>}
          </CardContent>
        </Card>
        <Card className="grid min-h-[26rem] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-0 py-0 lg:min-h-0">
          <section className="flex min-h-0 flex-col gap-5 py-5">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">받은 요청</CardTitle>
              {receivedRequests.length > 0 && <Badge>{receivedRequests.length}</Badge>}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {receivedRequests.length ? receivedRequests.map(({ id, profile }) => <div key={id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><UserAvatar name={profile.nickname || profile.handle} imageUrl={profile.avatar_url} className="size-10" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.nickname || profile.handle}</p><p className="text-xs text-muted-foreground">@{profile.handle}</p></div><RespondFriendRequestButtons requestId={id} /></div>) : <p className="my-auto py-6 text-center text-sm text-muted-foreground">받은 친구 요청이 없어요.</p>}
            </CardContent>
          </section>

          <section className="flex min-h-0 flex-col gap-5 border-t py-5">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">보낸 요청</CardTitle>
              {sentRequests.length > 0 && <Badge variant="secondary">{sentRequests.length}</Badge>}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {sentRequests.length ? sentRequests.map(({ id, profile }) => {
                const name = profile.nickname || profile.handle
                return <div key={id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                  <UserAvatar name={name} imageUrl={profile.avatar_url} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{profile.handle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline" className="gap-1 text-muted-foreground"><Clock3 className="size-3" />대기 중</Badge>
                    <CancelFriendRequestButton requestId={id} memberName={name} />
                  </div>
                </div>
              }) : <p className="my-auto py-6 text-center text-sm text-muted-foreground">보낸 친구 요청이 없어요.</p>}
            </CardContent>
          </section>
        </Card>
      </div>
    </div>
  )
}
