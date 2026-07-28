"use client"

import { Check, Puzzle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"

export function ExtensionStatus({ connected, tokenIssued, lastSeenAt }: { connected: boolean; tokenIssued: boolean; lastSeenAt: string | null }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirmReissue, setConfirmReissue] = useState(false)

  const issueToken = async () => {
    setPending(true)
    const response = await authenticatedFetch("/api/extension/token", { method: "POST" })
    const result = await response.json()
    setPending(false)
    if (!response.ok) return toast.error(result.error || "토큰을 만들지 못했습니다.")
    try {
      await navigator.clipboard.writeText(result.token)
      toast.success("연동 토큰을 발급하고 클립보드에 복사했습니다.")
    } catch {
      toast.error("토큰은 발급됐지만 자동 복사하지 못했습니다. 다시 발급해 주세요.")
    }
    router.refresh()
    setConfirmReissue(false)
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex size-9 items-center justify-center rounded-lg ${connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {connected ? <Check className="size-5" /> : <Puzzle className="size-5" />}
          </span>
          <div>
            <p className="text-sm font-medium">익스텐션 {connected ? "연동됨" : "미연동"}</p>
            <p className="text-xs text-muted-foreground">
              {connected && lastSeenAt ? `마지막 통신 ${new Date(lastSeenAt).toLocaleString("ko-KR")}` : "토큰 저장 후 첫 기록이 도착하면 연동됩니다."}
            </p>
          </div>
        </div>
        {!connected && !confirmReissue && <Button type="button" variant="outline" onClick={() => tokenIssued ? setConfirmReissue(true) : issueToken()} disabled={pending}>{pending ? "발급 중..." : tokenIssued ? "연동 토큰 재발급" : "연동 토큰 발급"}</Button>}
      </div>
      {confirmReissue && <div className="mt-4 rounded-lg border border-warning-foreground/30 bg-warning-foreground/10 p-3"><p className="text-xs leading-relaxed">재발급하면 기존 토큰과의 연동이 즉시 끊어집니다. 익스텐션에 새 토큰을 다시 등록해야 합니다.</p><div className="mt-3 flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setConfirmReissue(false)}>취소</Button><Button type="button" size="sm" onClick={issueToken} disabled={pending}>{pending ? "재발급 중..." : "재발급"}</Button></div></div>}
    </div>
  )
}
