"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LoaderCircle, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"
import { addStudyComment } from "@/app/actions"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"

export type LoungeComment = {
  id: string
  study_id: string
  author_id: string
  message: string
  created_at: string
  profile: LoungeProfile | null
}

export type LoungeProfile = {
  handle: string
  nickname: string
  avatar_url: string | null
}

type InsertedComment = Omit<LoungeComment, "profile">

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function appendComment(comments: LoungeComment[], comment: LoungeComment) {
  if (comments.some((item) => item.id === comment.id)) return comments

  const optimisticIndex = comments.findIndex(
    (item) => item.id.startsWith("optimistic-") && item.author_id === comment.author_id && item.message === comment.message,
  )
  if (optimisticIndex === -1) return [...comments, comment]

  const next = [...comments]
  next[optimisticIndex] = comment
  return next
}

const COMMENTS_PAGE_SIZE = 50
const DEGRADED_SYNC_INTERVAL_MS = 5_000

type RealtimeStatus = "connecting" | "connected" | "degraded"

function mergeComments(current: LoungeComment[], incoming: LoungeComment[]) {
  const comments = new Map(current.map((comment) => [comment.id, comment]))
  incoming.forEach((comment) => comments.set(comment.id, comment))
  return Array.from(comments.values()).sort((first, second) => {
    const timeDifference = Date.parse(first.created_at) - Date.parse(second.created_at)
    return timeDifference || first.id.localeCompare(second.id)
  })
}

export function StudyLounge({
  studyId,
  currentUserId,
  memberProfiles,
}: {
  studyId: string
  currentUserId: string
  memberProfiles: Record<string, LoungeProfile | null>
}) {
  const [comments, setComments] = useState<LoungeComment[]>([])
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting")
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const preserveScrollHeightRef = useRef<number | null>(null)
  const initialLoadStartedRef = useRef(false)
  const realtimeHealthyRef = useRef(false)
  const supabaseRef = useRef(createClient())

  const fetchCommentPage = useCallback(async (before?: string) => {
    let query = supabaseRef.current
      .from("study_comments")
      .select("id,study_id,author_id,message,created_at,profile:profiles!study_comments_author_id_fkey(handle,nickname,avatar_url)")
      .eq("study_id", studyId)
      .order("created_at", { ascending: false })
      .limit(COMMENTS_PAGE_SIZE + 1)

    if (before) query = query.lt("created_at", before)
    const { data, error } = await query
    if (error) throw error

    const rows = (data || []) as unknown as LoungeComment[]
    return {
      comments: rows.slice(0, COMMENTS_PAGE_SIZE).reverse(),
      hasMore: rows.length > COMMENTS_PAGE_SIZE,
    }
  }, [studyId])

  const loadRecentComments = useCallback(async () => {
    try {
      const page = await fetchCommentPage()
      setComments((current) => mergeComments(current, page.comments))
    } catch {
      // Realtime will continue retrying through visibility changes.
    }
  }, [fetchCommentPage])

  useEffect(() => {
    const supabase = supabaseRef.current
    let active = true
    const channel = supabase
      .channel(`study-lounge-${studyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "study_comments", filter: `study_id=eq.${studyId}` },
        (payload) => {
          const inserted = payload.new as InsertedComment
          if (!inserted.id || inserted.study_id !== studyId) return

          setComments((current) =>
            appendComment(current, {
              ...inserted,
              profile: memberProfiles[inserted.author_id] ?? null,
            }),
          )
        },
      )
      .subscribe((status, error) => {
        if (!active) return

        if (status === "SUBSCRIBED") {
          realtimeHealthyRef.current = true
          setRealtimeStatus("connected")
          // Postgres Changes does not replay events missed while reconnecting.
          void loadRecentComments()
          return
        }

        realtimeHealthyRef.current = false
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("degraded")
          console.error("study lounge realtime subscription failed", { status, error })
        } else if (status === "CLOSED") {
          setRealtimeStatus("connecting")
        }
      })

    if (!initialLoadStartedRef.current) {
      initialLoadStartedRef.current = true
      void fetchCommentPage()
        .then((page) => {
          setComments((current) => mergeComments(current, page.comments))
          setHasOlder(page.hasMore)
        })
        .catch((error) => toast.error(error instanceof Error ? error.message : "라운지 메시지를 불러오지 못했습니다."))
        .finally(() => setLoadingInitial(false))
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadRecentComments()
    }
    const fallbackSync = window.setInterval(() => {
      if (!realtimeHealthyRef.current && document.visibilityState === "visible") {
        void loadRecentComments()
      }
    }, DEGRADED_SYNC_INTERVAL_MS)

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      active = false
      realtimeHealthyRef.current = false
      window.clearInterval(fallbackSync)
      void supabase.removeChannel(channel)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchCommentPage, loadRecentComments, memberProfiles, studyId])

  useEffect(() => {
    const element = scrollAreaRef.current
    if (!element) return
    if (preserveScrollHeightRef.current != null) {
      element.scrollTop += element.scrollHeight - preserveScrollHeightRef.current
      preserveScrollHeightRef.current = null
    } else {
      element.scrollTop = element.scrollHeight
    }
  }, [comments])

  async function loadOlderComments() {
    const oldest = comments[0]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    preserveScrollHeightRef.current = scrollAreaRef.current?.scrollHeight ?? null
    try {
      const page = await fetchCommentPage(oldest.created_at)
      setComments((current) => mergeComments(current, page.comments))
      setHasOlder(page.hasMore)
    } catch (error) {
      preserveScrollHeightRef.current = null
      toast.error(error instanceof Error ? error.message : "이전 메시지를 불러오지 못했습니다.")
    } finally {
      setLoadingOlder(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextMessage = message.trim()
    if (!nextMessage || pending) return

    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticComment: LoungeComment = {
      id: optimisticId,
      study_id: studyId,
      author_id: currentUserId,
      message: nextMessage,
      created_at: new Date().toISOString(),
      profile: memberProfiles[currentUserId] ?? null,
    }

    setComments((current) => [...current, optimisticComment])
    setMessage("")
    setPending(true)
    try {
      const inserted = await addStudyComment(studyId, nextMessage)
      setComments((current) => {
        const withoutOptimistic = current.filter((comment) => comment.id !== optimisticId)
        return appendComment(withoutOptimistic, {
          ...inserted,
          profile: memberProfiles[inserted.author_id] ?? null,
        })
      })
    } catch (error) {
      setComments((current) => current.filter((comment) => comment.id !== optimisticId))
      setMessage(nextMessage)
      toast.error(error instanceof Error ? error.message : "메시지를 보내지 못했어요.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardHeader className="flex-row items-center gap-2">
        <MessageSquare className="size-4 text-primary" />
        <CardTitle className="text-base">스터디 라운지</CardTitle>
        <span className="ml-auto text-xs text-muted-foreground">
          {realtimeStatus === "connected" ? "실시간 동기화" : realtimeStatus === "degraded" ? "자동 동기화" : "연결 중"}
        </span>
      </CardHeader>
      <CardContent>
        <div ref={scrollAreaRef} className="flex h-72 flex-col gap-4 overflow-y-auto overscroll-contain pr-2 sm:h-80" aria-live="polite">
          {loadingInitial ? (
            <div className="flex h-full shrink-0 items-center justify-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />메시지를 불러오는 중...</div>
          ) : comments.length === 0 ? (
            <div className="flex h-full shrink-0 flex-col items-center justify-center text-center">
              <MessageSquare className="mb-2 size-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">첫 메시지를 남겨보세요</p>
              <p className="mt-1 text-xs text-muted-foreground">스터디원들과 목표와 진행 상황을 나눌 수 있어요.</p>
            </div>
          ) : <>
            {hasOlder && <Button type="button" variant="ghost" size="sm" className="mx-auto shrink-0" onClick={loadOlderComments} disabled={loadingOlder}>{loadingOlder && <LoaderCircle className="size-3.5 animate-spin" />}{loadingOlder ? "불러오는 중..." : "이전 메시지 불러오기"}</Button>}
            {comments.map((comment) => {
            const name = comment.profile?.nickname || comment.profile?.handle || "멤버"
            return (
              <div key={comment.id} className="flex gap-2">
                <UserAvatar name={name} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-medium">{name}</p>
                    <time className="shrink-0 text-[10px] text-muted-foreground" dateTime={comment.created_at}>{formatTime(comment.created_at)}</time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.message}</p>
                </div>
              </div>
            )
            })}
          </>}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
          <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="스터디원들에게 메시지 보내기" maxLength={500} disabled={pending} />
          <Button type="submit" size="icon" disabled={pending || !message.trim()} aria-label="메시지 전송"><Send className="size-4" /></Button>
        </form>
      </CardContent>
    </Card>
  )
}
