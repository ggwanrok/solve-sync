import { ArrowRight, Crown, Lock, Search, Users } from "lucide-react"
import Link from "next/link"
import { CreateStudyDialog } from "@/components/create-study-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/server"

type SearchField = "title" | "description" | "owner"
type OwnerProfile = { handle: string; nickname: string }

export default async function StudyListPage({
  searchParams,
}: {
  searchParams: Promise<{ field?: string; query?: string }>
}) {
  const params = await searchParams
  const field: SearchField = ["title", "description", "owner"].includes(params.field || "")
    ? params.field as SearchField
    : "title"
  const query = (params.query || "").trim().toLocaleLowerCase("ko-KR")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: rooms }, { data: memberships }] = await Promise.all([
    supabase
      .from("study_rooms")
      .select("id,owner_id,name,description,goal_period,goal_count,is_private,created_at,owner:profiles!study_rooms_owner_id_fkey(handle,nickname)")
      .order("created_at", { ascending: false }),
    supabase.from("study_members").select("study_id,user_id,role"),
  ])
  const studyRooms = rooms || []
  const filteredRooms = query
    ? studyRooms.filter((room) => {
        const owner = room.owner as unknown as OwnerProfile | null
        const target = field === "title"
          ? room.name
          : field === "description"
            ? room.description
            : `${owner?.nickname || ""} ${owner?.handle || ""}`
        return target.toLocaleLowerCase("ko-KR").includes(query)
      })
    : studyRooms

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">스터디룸</h1>
          <p className="mt-1 text-sm text-muted-foreground">전체 스터디룸 {studyRooms.length}개 · 함께 공부할 방을 찾아보세요.</p>
        </div>
        <CreateStudyDialog />
      </div>

      <form method="get" className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row">
        <select
          name="field"
          defaultValue={field}
          aria-label="검색 기준"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 sm:w-44"
        >
          <option value="title">제목으로 검색</option>
          <option value="description">설명으로 검색</option>
          <option value="owner">방장 이름으로 검색</option>
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input key={params.query || "empty-query"} name="query" defaultValue={params.query || ""} placeholder="검색어를 입력하세요" className="h-9 pl-9" />
        </div>
        <Button type="submit" className="h-9 px-4">검색</Button>
        {query && <Button render={<Link href="/study" />} nativeButton={false} type="button" variant="outline" className="h-9 px-4">초기화</Button>}
      </form>

      {query && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">‘{params.query?.trim()}’</span> 검색 결과 {filteredRooms.length}개</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredRooms.map((room) => {
          const members = (memberships || []).filter((item) => item.study_id === room.id)
          const leader = room.owner_id === user?.id
          const joined = members.some((item) => item.user_id === user?.id)
          const owner = room.owner as unknown as OwnerProfile | null
          const ownerName = owner?.nickname || owner?.handle || "방장"
          return (
            <Card key={room.id} className="group transition-colors hover:border-primary/40">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{room.name}</h2>
                    {room.is_private && <Lock className="size-3.5 text-muted-foreground" />}
                    {leader && <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-xs"><Crown className="size-3 text-warning-foreground" />리더</Badge>}
                    {!leader && joined && <Badge variant="secondary" className="px-1.5 py-0 text-xs">참여 중</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{room.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">방장 · {ownerName}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">규칙 · </span>
                  <span className="font-medium">{room.goal_period === "daily" ? "매일" : "매주"} {room.goal_count}문제</span>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" />{members.length}명</span>
                    <Button render={<Link href={`/study/${room.id}`} />} nativeButton={false} variant="ghost" size="sm" className="h-8 gap-1 text-xs">{joined ? "입장" : "둘러보기"}<ArrowRight className="size-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredRooms.length === 0 && (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Search className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">검색 결과가 없습니다.</p>
          <p className="mt-1 text-xs text-muted-foreground">다른 검색어나 검색 기준을 사용해보세요.</p>
        </div>
      )}
    </div>
  )
}
