import { Check, X } from "lucide-react"
import { respondFriendRequest } from "@/app/actions"
import type { ContributionDay } from "@/components/contribution-graph"
import { FriendCard, type FriendCardProfile } from "@/components/friend-card"
import { FriendRequestForm } from "@/components/friend-request-form"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  const [{ data: relations }, { data: incoming }, { data: contributionData, error: contributionError }] = await Promise.all([
    supabase.from("friendships").select("friend_id, friend:profiles!friendships_friend_id_fkey(id,handle,nickname,avatar_url)").eq("user_id", user.id),
    supabase.from("friend_requests").select("id, sender:profiles!friend_requests_sender_id_fkey(id,handle,nickname,avatar_url)").eq("receiver_id", user.id).eq("status", "pending"),
    supabase.rpc("friend_contribution_events", { first_date: firstDate }),
  ])
  const friends = (relations || []).map((row) => row.friend as unknown as Profile).filter(Boolean)
  const requests = (incoming || []).map((row) => ({ id: row.id, profile: row.sender as unknown as Profile })).filter((row) => row.profile)
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
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">받은 요청</CardTitle>{requests.length > 0 && <Badge>{requests.length}</Badge>}</CardHeader>
          <CardContent className="flex flex-col gap-3">
            {requests.length ? requests.map(({ id, profile }) => <div key={id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><UserAvatar name={profile.nickname || profile.handle} imageUrl={profile.avatar_url} className="size-10" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.nickname || profile.handle}</p><p className="text-xs text-muted-foreground">@{profile.handle}</p></div><form action={respondFriendRequest} className="flex gap-1.5"><input type="hidden" name="requestId" value={id} /><Button type="submit" name="decision" value="accept" size="icon-sm" aria-label="수락"><Check className="size-4" /></Button><Button type="submit" name="decision" value="decline" size="icon-sm" variant="outline" aria-label="거절"><X className="size-4" /></Button></form></div>) : <p className="py-8 text-center text-sm text-muted-foreground">받은 친구 요청이 없어요.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
