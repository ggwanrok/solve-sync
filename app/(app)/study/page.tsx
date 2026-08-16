import { ChevronDown, ChevronLeft, ChevronRight, Crown, Lock, Search, Users } from "lucide-react"
import Link from "next/link"
import { CreateStudyDialog } from "@/components/create-study-dialog"
import { StudyDifficultyRange } from "@/components/study-difficulty-range"
import { StudyRoomEntryButton } from "@/components/study-room-entry-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/difficulty"
import { redirect } from "next/navigation"
import { getViewer } from "@/lib/server/viewer"

type SearchField = "title" | "description" | "owner"
type StudyDirectoryView = "all" | "joined"
type StudySearchParams = {
  field?: string
  query?: string
  page?: string
  minDifficulty?: string
  view?: string
}
type StudyRoomDirectoryItem = {
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

type StudyRoomDirectory = {
  rooms: StudyRoomDirectoryItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 12

function studyPageHref({
  field,
  query,
  page = 1,
  minDifficulty = 0,
  view = "all",
}: {
  field: SearchField
  query: string
  page?: number
  minDifficulty?: DifficultyLevel
  view?: StudyDirectoryView
}) {
  const search = new URLSearchParams()
  if (query) {
    search.set("field", field)
    search.set("query", query)
  }
  if (minDifficulty > 0) search.set("minDifficulty", String(minDifficulty))
  if (view === "joined") search.set("view", view)
  if (page > 1) search.set("page", String(page))
  const queryString = search.toString()
  return queryString ? `/study?${queryString}` : "/study"
}

function parseMinDifficulty(value: string | undefined): DifficultyLevel {
  const level = Number(value)
  return DIFFICULTY_LEVELS.includes(level as DifficultyLevel) ? level as DifficultyLevel : 0
}

export default async function StudyListPage({
  searchParams,
}: {
  searchParams: Promise<StudySearchParams>
}) {
  const params = await searchParams
  const field: SearchField = ["title", "description", "owner"].includes(params.field || "")
    ? params.field as SearchField
    : "title"
  const query = (params.query || "").trim()
  const parsedPage = Number.parseInt(params.page || "1", 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const minDifficulty = parseMinDifficulty(params.minDifficulty)
  const difficulties = DIFFICULTY_LEVELS.filter((level) => level >= minDifficulty)
  const view: StudyDirectoryView = params.view === "joined" ? "joined" : "all"
  const joinedOnly = view === "joined"
  const { supabase, user } = await getViewer()
  if (!user) redirect("/login")
  const { data, error } = await supabase.rpc("study_room_directory", {
    directory_field: field,
    directory_query: query,
    page_number: page,
    page_size: PAGE_SIZE,
    difficulty_levels: difficulties,
    joined_only: joinedOnly,
  })
  if (error) throw new Error(`스터디룸 목록을 불러오지 못했습니다: ${error.message}`)

  const directory = data as unknown as StudyRoomDirectory | null
  const studyRooms = directory?.rooms || []
  const total = Number(directory?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (page > totalPages) redirect(studyPageHref({ field, query, page: totalPages, minDifficulty, view }))

  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - 4))
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstVisiblePage + index,
  )
  const hasSearchFilters = Boolean(query) || minDifficulty > 0
  const directoryLabel = joinedOnly ? "참여 중인 스터디룸" : "전체 스터디룸"
  const resetHref = studyPageHref({ field: "title", query: "", minDifficulty: 0, view })
  const joinedHref = studyPageHref({ field, query, minDifficulty, view: "joined" })
  const allHref = studyPageHref({ field, query, minDifficulty, view: "all" })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">스터디룸</h1>
          <p className="mt-1 text-sm text-muted-foreground">{hasSearchFilters ? `${directoryLabel} 검색 결과 ${total}개` : `${directoryLabel} ${total}개`} · 함께 공부할 방을 찾아보세요.</p>
        </div>
        <CreateStudyDialog />
      </div>

      <form method="get" className="rounded-xl border bg-card p-3">
        <input type="hidden" name="view" value={view} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-44">
            <select
              name="field"
              defaultValue={field}
              aria-label="검색 기준"
              className="h-9 w-full appearance-none rounded-lg border border-input bg-background py-0 pl-3 pr-10 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option value="title">제목으로 검색</option>
              <option value="description">설명으로 검색</option>
              <option value="owner">방장 이름으로 검색</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input key={params.query || "empty-query"} name="query" defaultValue={params.query || ""} placeholder="검색어를 입력하세요" className="h-9 pl-9" />
          </div>
          <Button type="submit" className="h-9 px-4">검색</Button>
          {hasSearchFilters && <Button render={<Link href={resetHref} />} nativeButton={false} type="button" variant="outline" className="h-9 px-4">필터 초기화</Button>}
        </div>
        <fieldset className="mt-3 border-t pt-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">포함할 방 난이도</legend>
          <div className="mt-1"><StudyDifficultyRange key={minDifficulty} defaultValue={minDifficulty} /></div>
        </fieldset>
      </form>

      <nav className="flex w-full border-b" aria-label="스터디룸 보기 방식">
        <Button
          render={<Link href={joinedHref} />}
          nativeButton={false}
          variant="ghost"
          className={`rounded-b-none border-b-2 px-4 ${joinedOnly ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          aria-current={joinedOnly ? "page" : undefined}
        >
          참여 중인 스터디룸
        </Button>
        <Button
          render={<Link href={allHref} />}
          nativeButton={false}
          variant="ghost"
          className={`rounded-b-none border-b-2 px-4 ${!joinedOnly ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          aria-current={!joinedOnly ? "page" : undefined}
        >
          모두 둘러보기
        </Button>
      </nav>

      {query && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">‘{query}’</span>에 해당하는 스터디룸입니다.</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {studyRooms.map((room) => {
          const leader = room.owner_id === user?.id
          const joined = room.is_joined
          const ownerName = room.owner_nickname || room.owner_handle || "방장"
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
                  <p className="mt-1 h-10 line-clamp-2 text-sm text-muted-foreground">{room.description || <span className="sr-only">소개 없음</span>}</p>
                  <p className="mt-2 text-xs text-muted-foreground">방장 · {ownerName}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">규칙 · </span>
                  <span className="font-medium">{room.goal_period === "daily" ? "매일" : "매주"} {room.goal_count}문제 · Lv.{room.min_difficulty} 이상</span>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" />{room.member_count}명</span>
                    <StudyRoomEntryButton studyId={room.id} joined={joined} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {studyRooms.length === 0 && (
        <div className="rounded-xl border border-dashed py-16 text-center">
          {joinedOnly && !hasSearchFilters ? <Users className="mx-auto mb-3 size-8 text-muted-foreground/50" /> : <Search className="mx-auto mb-3 size-8 text-muted-foreground/50" />}
          <p className="text-sm font-medium">
            {joinedOnly && !hasSearchFilters
              ? "참여 중인 스터디룸이 없습니다."
              : "검색 결과가 없습니다."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {joinedOnly && !hasSearchFilters
              ? "모두 둘러보기에서 함께할 스터디룸을 찾아보세요."
              : "다른 검색어나 검색 조건을 사용해보세요."}
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1" aria-label="스터디룸 페이지">
          {page > 1 ? (
            <Button render={<Link href={studyPageHref({ field, query, page: page - 1, minDifficulty, view })} />} nativeButton={false} variant="outline" size="icon" aria-label="이전 페이지"><ChevronLeft className="size-4" /></Button>
          ) : (
            <Button type="button" variant="outline" size="icon" aria-label="이전 페이지" disabled><ChevronLeft className="size-4" /></Button>
          )}
          {visiblePages.map((pageNumber) => (
            <Button
              key={pageNumber}
              render={<Link href={studyPageHref({ field, query, page: pageNumber, minDifficulty, view })} />}
              nativeButton={false}
              variant={pageNumber === page ? "default" : "outline"}
              size="icon"
              aria-label={`${pageNumber}페이지`}
              aria-current={pageNumber === page ? "page" : undefined}
            >
              {pageNumber}
            </Button>
          ))}
          {page < totalPages ? (
            <Button render={<Link href={studyPageHref({ field, query, page: page + 1, minDifficulty, view })} />} nativeButton={false} variant="outline" size="icon" aria-label="다음 페이지"><ChevronRight className="size-4" /></Button>
          ) : (
            <Button type="button" variant="outline" size="icon" aria-label="다음 페이지" disabled><ChevronRight className="size-4" /></Button>
          )}
        </nav>
      )}
    </div>
  )
}
