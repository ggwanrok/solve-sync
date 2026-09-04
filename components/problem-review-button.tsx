"use client"

import { Bookmark, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ProblemReviewButton({ needsReview, title, pending, compact = false, onClick }: {
  needsReview: boolean
  title: string
  pending: boolean
  compact?: boolean
  onClick: () => void
}) {
  const label = `${title}: 다시 풀 문제 ${needsReview ? "해제" : "지정"}`
  return (
    <Button
      type="button"
      variant={needsReview ? "secondary" : compact ? "ghost" : "outline"}
      size={compact ? "icon" : "default"}
      className={cn(needsReview && "text-primary")}
      disabled={pending}
      aria-busy={pending}
      aria-pressed={needsReview}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Bookmark className={cn("size-4", needsReview && "fill-current")} />}
      {!compact && "다시 풀 문제"}
    </Button>
  )
}
