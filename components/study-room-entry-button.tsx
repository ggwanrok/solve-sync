"use client"

import Link, { useLinkStatus } from "next/link"
import { ArrowRight, LoaderCircle } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

function EntryLabel({ joined }: { joined: boolean }) {
  const { pending } = useLinkStatus()
  return (
    <span className="inline-flex items-center gap-1.5" aria-busy={pending}>
      {pending ? "이동 중..." : joined ? "입장" : "둘러보기"}
      {pending
        ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        : <ArrowRight className="size-3.5" aria-hidden="true" />}
    </span>
  )
}

export function StudyRoomEntryButton({ studyId, joined }: { studyId: string; joined: boolean }) {
  return (
    <Link href={`/study/${studyId}`} className={buttonVariants({ variant: "ghost", size: "sm", className: "h-9 min-w-24 text-xs" })}>
      <EntryLabel joined={joined} />
    </Link>
  )
}
