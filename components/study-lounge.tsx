"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageSquare, Send } from "lucide-react"
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

export function StudyLounge({
  studyId,
  currentUserId,
  initialComments,
  memberProfiles,
}: {
  studyId: string
  currentUserId: string
  initialComments: LoungeComment[]
  memberProfiles: Record<string, LoungeProfile | null>
}) {
  const [comments, setComments] = useState(initialComments)
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())

  const loadComments = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("study_comments")
      .select("id,study_id,author_id,message,created_at,profile:profiles!study_comments_author_id_fkey(handle,nickname,avatar_url)")
      .eq("study_id", studyId)
      .order("created_at")

    if (!error && data) {
      setComments((current) =>
        (data as unknown as LoungeComment[]).reduce(appendComment, current),
      )
    }
  }, [studyId])

  useEffect(() => {
    const supabase = supabaseRef.current
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
      .subscribe()
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadComments()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [loadComments, memberProfiles, studyId])

  useEffect(() => {
    const element = scrollAreaRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [comments])

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
        <span className="ml-auto text-xs text-muted-foreground">자동 동기화</span>
      </CardHeader>
      <CardContent>
        <div ref={scrollAreaRef} className="flex h-72 flex-col gap-4 overflow-y-auto overscroll-contain pr-2 sm:h-80" aria-live="polite">
          {comments.length === 0 ? (
            <div className="flex h-full shrink-0 flex-col items-center justify-center text-center">
              <MessageSquare className="mb-2 size-7 text-muted-foreground/50" />
              <p className="text-sm font-medium">첫 메시지를 남겨보세요</p>
              <p className="mt-1 text-xs text-muted-foreground">스터디원들과 목표와 진행 상황을 나눌 수 있어요.</p>
            </div>
          ) : comments.map((comment) => {
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
        </div>
        <form className="mt-4 flex gap-2" onSubmit={handleSubmit}>
          <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="스터디원들에게 메시지 보내기" maxLength={500} disabled={pending} />
          <Button type="submit" size="icon" disabled={pending || !message.trim()} aria-label="메시지 전송"><Send className="size-4" /></Button>
        </form>
      </CardContent>
    </Card>
  )
}
