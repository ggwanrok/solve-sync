"use client"

import { Send } from "lucide-react"
import { useState } from "react"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { currentUser, type StudyComment } from "@/lib/mock-data"

export function StudyComments({ initial }: { initial: StudyComment[] }) {
  const [comments, setComments] = useState<StudyComment[]>(initial)
  const [value, setValue] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (e.nativeEvent instanceof KeyboardEvent && (e.nativeEvent as KeyboardEvent).isComposing) return
    if (!value.trim()) return
    setComments((prev) => [
      { id: `c-${Date.now()}`, name: currentUser.name, avatar: currentUser.avatar, message: value.trim(), time: "방금 전" },
      ...prev,
    ])
    setValue("")
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="스터디원들에게 한마디 남겨보세요"
        />
        <Button type="submit" size="icon" aria-label="댓글 등록" disabled={!value.trim()}>
          <Send className="size-4" />
        </Button>
      </form>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">아직 남겨진 메시지가 없어요. 첫 메시지를 남겨보세요!</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <UserAvatar name={c.name} className="size-8" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.time}</span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">{c.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
