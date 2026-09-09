"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DASHBOARD_PAGE_SIZE } from "@/lib/dashboard"

export function DashboardPagination({ page, totalCount, pending, label, onPageChange }: {
  page: number
  totalCount: number
  pending: boolean
  label: string
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / DASHBOARD_PAGE_SIZE))
  const [requestedPage, setRequestedPage] = useState<number | null>(null)
  const pendingPage = pending ? requestedPage : null
  if (totalCount === 0) return null

  return (
    <nav aria-label={`${label} 페이지 이동`} className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
      <Button type="button" variant="outline" size="sm" disabled={pending || page <= 1} aria-busy={pendingPage === page - 1} onClick={() => { setRequestedPage(page - 1); onPageChange(page - 1) }} aria-label={`${label} 이전 페이지`}>
        {pendingPage === page - 1 ? <Loader2 className="animate-spin" /> : <ChevronLeft />}이전
      </Button>
      <span role="status" className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        <span className="sr-only">{label} </span>{page} / {totalPages}<span className="sr-only"> 페이지{pending ? ", 불러오는 중" : ""}</span>
      </span>
      <Button type="button" variant="outline" size="sm" disabled={pending || page >= totalPages} aria-busy={pendingPage === page + 1} onClick={() => { setRequestedPage(page + 1); onPageChange(page + 1) }} aria-label={`${label} 다음 페이지`}>
        다음{pendingPage === page + 1 ? <Loader2 className="animate-spin" /> : <ChevronRight />}
      </Button>
    </nav>
  )
}
