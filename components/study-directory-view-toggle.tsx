"use client"

import { LoaderCircle } from "lucide-react"
import Link, { useLinkStatus } from "next/link"
import { Button } from "@/components/ui/button"

function ViewLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus()
  return (
    <span className="inline-flex items-center gap-1.5" aria-busy={pending}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </span>
  )
}

export function StudyDirectoryViewToggle({ joinedHref, allHref, joinedOnly }: {
  joinedHref: string
  allHref: string
  joinedOnly: boolean
}) {
  return (
    <nav className="flex w-fit rounded-xl bg-muted/70 p-1" aria-label="스터디룸 보기 방식">
      <Button
        render={<Link href={joinedHref} />}
        nativeButton={false}
        variant="ghost"
        className={`h-9 min-w-36 rounded-lg px-4 ${joinedOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        aria-current={joinedOnly ? "page" : undefined}
      >
        <ViewLabel>참여 중인 스터디룸</ViewLabel>
      </Button>
      <Button
        render={<Link href={allHref} />}
        nativeButton={false}
        variant="ghost"
        className={`h-9 min-w-32 rounded-lg px-4 ${!joinedOnly ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        aria-current={!joinedOnly ? "page" : undefined}
      >
        <ViewLabel>모두 둘러보기</ViewLabel>
      </Button>
    </nav>
  )
}
