import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react"
import Link from "next/link"
import { CreateStudyDialog } from "@/components/create-study-dialog"
import { StudyDifficultyRange } from "@/components/study-difficulty-range"
import { StudyRoomGrid, type StudyRoomDirectoryItem } from "@/components/study-room-grid"
import { StudySearchFieldMenu, type StudySearchField } from "@/components/study-search-field-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/difficulty"
import { parseStudyDirectoryView, type StudyDirectoryView } from "@/lib/study-directory-view"
import { redirect } from "next/navigation"
import { getViewer } from "@/lib/server/viewer"

type StudySearchParams = {
  field?: string
  query?: string
  page?: string
  minDifficulty?: string
  view?: string
}
type StudyRoomDirectory = {
  rooms: StudyRoomDirectoryItem[]
  total: number
  page: number
  pageSize: number
}
type MembershipOrderRow = { study_id: string; sort_order: number | null; joined_at: string }

const PAGE_SIZE = 12

function studyPageHref({
  field,
  query,
  page = 1,
  minDifficulty = 0,
  view = "joined",
}: {
  field: StudySearchField
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
  if (view === "all") search.set("view", view)
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
  const field: StudySearchField = ["title", "description", "owner"].includes(params.field || "")
    ? params.field as StudySearchField
    : "title"
  const query = (params.query || "").trim()
  const parsedPage = Number.parseInt(params.page || "1", 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const minDifficulty = parseMinDifficulty(params.minDifficulty)
  const difficulties = DIFFICULTY_LEVELS.filter((level) => level >= minDifficulty)
  const view = parseStudyDirectoryView(params.view)
  const joinedOnly = view === "joined"
  const { supabase, user } = await getViewer()
  if (!user) redirect("/login")
  const membershipOrderPromise = joinedOnly
    ? supabase.from("study_members").select("study_id,sort_order,joined_at").eq("user_id", user.id)
    : Promise.resolve({ data: [] as MembershipOrderRow[], error: null })
  const [
    { data, error },
    { data: membershipOrderData, error: membershipOrderError },
  ] = await Promise.all([
    supabase.rpc("study_room_directory", {
      directory_field: field,
      directory_query: query,
      page_number: page,
      page_size: PAGE_SIZE,
      difficulty_levels: difficulties,
      joined_only: joinedOnly,
    }),
    membershipOrderPromise,
  ])
  if (error) throw new Error(`스터디룸 목록을 불러오지 못했습니다: ${error.message}`)

  const membershipRows = (membershipOrderData || []) as MembershipOrderRow[]
  const compareDefaultOrder = (first: MembershipOrderRow, second: MembershipOrderRow) =>
    Date.parse(first.joined_at) - Date.parse(second.joined_at) || first.study_id.localeCompare(second.study_id)
  const defaultJoinedRoomIds = [...membershipRows].sort(compareDefaultOrder).map((membership) => membership.study_id)
  const joinedRoomIds = [...membershipRows]
    .sort((first, second) => {
      const firstOrder = first.sort_order ?? Number.MAX_SAFE_INTEGER
      const secondOrder = second.sort_order ?? Number.MAX_SAFE_INTEGER
      return firstOrder - secondOrder || compareDefaultOrder(first, second)
    })
    .map((membership) => membership.study_id)
  const orderAvailable = !membershipOrderError
  if (membershipOrderError && !(membershipOrderError.code === "42703" && membershipOrderError.message.includes("sort_order"))) {
    console.error("study room order lookup failed", membershipOrderError)
  }

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
    <div className="page-container">
      <form method="get" className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/[0.055] sm:p-5">
        <input type="hidden" name="view" value={view} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <StudySearchFieldMenu defaultValue={field} />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input key={params.query || "empty-query"} name="query" defaultValue={params.query || ""} placeholder="검색어를 입력하세요" className="pl-10" />
          </div>
          <Button type="submit">검색</Button>
          {hasSearchFilters && <Button render={<Link href={resetHref} />} nativeButton={false} type="button" variant="outline">필터 초기화</Button>}
        </div>
        <fieldset className="mt-3 border-t pt-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">포함할 방 난이도</legend>
          <div className="mt-1"><StudyDifficultyRange key={minDifficulty} defaultValue={minDifficulty} /></div>
        </fieldset>
      </form>

      <StudyRoomGrid
        key={`${user.id}-${view}`}
        rooms={studyRooms}
        currentUserId={user.id}
        joinedRoomIds={joinedRoomIds}
        defaultJoinedRoomIds={defaultJoinedRoomIds}
        canReorder={joinedOnly && orderAvailable}
        directorySummary={hasSearchFilters ? `${directoryLabel} 검색 결과 ${total}개` : `${directoryLabel} ${total}개`}
        toolbarStart={(
          <nav className="flex w-fit rounded-xl bg-muted/70 p-1" aria-label="스터디룸 보기 방식">
            <Button
              render={<Link href={joinedHref} />}
              nativeButton={false}
              variant="ghost"
              className={`h-9 rounded-lg px-4 ${joinedOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              aria-current={joinedOnly ? "page" : undefined}
            >
              참여 중인 스터디룸
            </Button>
            <Button
              render={<Link href={allHref} />}
              nativeButton={false}
              variant="ghost"
              className={`h-9 rounded-lg px-4 ${!joinedOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              aria-current={!joinedOnly ? "page" : undefined}
            >
              모두 둘러보기
            </Button>
          </nav>
        )}
        toolbarEnd={<CreateStudyDialog />}
      >
        {query && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">‘{query}’</span>에 해당하는 스터디룸입니다.</p>}
      </StudyRoomGrid>

      {studyRooms.length === 0 && (
        <div className="empty-state">
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
