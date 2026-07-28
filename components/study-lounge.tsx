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
  message: string
  created_at: string
  profile: {
    handle: string
    nickname: string
    avatar_url: string | null
  } | null
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function StudyLounge({ studyId, initialComments }: { studyId: string; initialComments: LoungeComment[] }) {
  const [comments, setComments] = useState(initialComments)
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())

  const loadComments = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from("study_comments")
      .select("id,message,created_at,profile:profiles!study_comments_author_id_fkey(handle,nickname,avatar_url)")
      .eq("study_id", studyId)
      .order("created_at")

    if (!error && data) setComments(data as unknown as LoungeComment[])
  }, [studyId])

  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`study-lounge-${studyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "study_comments", filter: `study_id=eq.${studyId}` },
        () => void loadComments(),
      )
      .subscribe()
    const interval = window.setInterval(loadComments, 3000)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadComments()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      void supabase.removeChannel(channel)
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [loadComments, studyId])

  useEffect(() => {
    const element = scrollAreaRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [comments])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextMessage = message.trim()
    if (!nextMessage || pending) return

    setPending(true)
    try {
      await addStudyComment(studyId, nextMessage)
      setMessage("")
      await loadComments()
    } catch (error) {
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
