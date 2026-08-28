"use client"

import { useState, type MouseEvent } from "react"
import Link from "next/link"
import { ArrowRight, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function StudyRoomEntryButton({
  studyId,
  joined,
}: {
  studyId: string
  joined: boolean
}) {
  const [pending, setPending] = useState(false)

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return

    setPending(true)
  }

  return (
    <>
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="스터디룸 이동 중"
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-8 py-6 shadow-lg">
            <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden="true" />
            <div className="text-center">
              <p className="font-medium">스터디룸으로 이동하고 있어요</p>
              <p className="mt-1 text-xs text-muted-foreground">방 정보를 불러오는 중입니다.</p>
            </div>
          </div>
        </div>
      )}
      <Button
        render={<Link href={`/study/${studyId}`} onClick={handleClick} />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 text-xs"
        aria-disabled={pending}
      >
        {pending ? "이동 중..." : joined ? "입장" : "둘러보기"}
        {pending
          ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          : <ArrowRight className="size-3.5" aria-hidden="true" />}
      </Button>
    </>
  )
}
