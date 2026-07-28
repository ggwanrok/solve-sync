"use client"

import { KeyRound, LogOut, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"

export type AccountUser = {
  name: string
  handle: string
  extensionConnected?: boolean
  extensionTokenCreatedAt?: string | null
  extensionLastSeenAt?: string | null
}

export function AccountDialog({ user }: { user: AccountUser }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [confirmReissue, setConfirmReissue] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const issueToken = async () => {
    setIssuing(true)
    const response = await authenticatedFetch("/api/extension/token", { method: "POST" })
    const result = await response.json()
    setIssuing(false)
    if (!response.ok) return toast.error(result.error || "토큰을 발급하지 못했습니다.")
    try {
      await navigator.clipboard.writeText(result.token)
      toast.success("새 연동 토큰을 발급하고 복사했습니다.")
    } catch {
      toast.error("토큰은 발급됐지만 자동 복사하지 못했습니다.")
    }
    setConfirmReissue(false)
    router.refresh()
  }

  const deleteAccount = async () => {
    setDeleting(true)
    try {
      const response = await authenticatedFetch("/api/account", { method: "DELETE" })
      const body = await response.text()
      let result: { error?: string } = {}
      try { result = body ? JSON.parse(body) : {} } catch { /* Vercel timeout/error page */ }
      if (!response.ok) return toast.error(result.error || "탈퇴 처리에 실패했습니다.")
      window.location.replace("/login")
    } catch {
      toast.error("탈퇴 요청을 완료하지 못했습니다. 네트워크 상태를 확인해 주세요.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-full outline-none ring-ring focus-visible:ring-2"
        aria-label="마이페이지 열기"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <UserAvatar name={user.name} className="size-9" />
      </button>
      {open && <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-xs"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-dialog-title"
          aria-describedby="account-dialog-description"
          className="relative grid w-full max-w-md gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/10"
        >
        <button type="button" className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-md hover:bg-muted" aria-label="마이페이지 닫기" onClick={() => setOpen(false)}><X className="size-4" /></button>
        <div className="flex flex-col gap-2 pr-8"><h2 id="account-dialog-title" className="text-base font-medium">마이페이지</h2><p id="account-dialog-description" className="text-sm text-muted-foreground">계정과 익스텐션 연동 정보를 관리합니다.</p></div>
        <div className="flex items-center gap-3 rounded-xl border p-4"><UserAvatar name={user.name} className="size-11" /><div><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">고유 닉네임 · {user.handle}</p></div></div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between"><div><p className="text-sm font-medium">익스텐션 {user.extensionConnected ? "연동됨" : "미연동"}</p><p className="mt-1 text-xs text-muted-foreground">{user.extensionLastSeenAt ? `마지막 통신 ${new Date(user.extensionLastSeenAt).toLocaleString("ko-KR")}` : user.extensionTokenCreatedAt ? `토큰 발급 ${new Date(user.extensionTokenCreatedAt).toLocaleString("ko-KR")}` : "발급된 토큰이 없습니다."}</p></div><KeyRound className="size-5 text-muted-foreground" /></div>
          {confirmReissue ? <div className="mt-3 rounded-lg border border-warning-foreground/30 bg-warning-foreground/10 p-3"><p className="text-xs leading-relaxed">재발급하면 기존 토큰과의 연동이 즉시 끊어집니다. 익스텐션에 새 토큰을 다시 등록해야 합니다.</p><div className="mt-3 flex gap-2"><Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setConfirmReissue(false)}>취소</Button><Button type="button" size="sm" className="flex-1" onClick={issueToken} disabled={issuing}>{issuing ? "재발급 중..." : "재발급"}</Button></div></div> : <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => user.extensionTokenCreatedAt ? setConfirmReissue(true) : issueToken()} disabled={issuing}>{issuing ? "발급 중..." : user.extensionTokenCreatedAt ? "연동 토큰 재발급" : "연동 토큰 발급"}</Button>}
        </div>
        <Button render={<Link href="/auth/signout" />} nativeButton={false} variant="outline" className="w-full"><LogOut className="size-4" />로그아웃</Button>
        <div className="rounded-xl border border-destructive/30 p-4">
          {!confirmDelete ? <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />회원 탈퇴</Button> : <div className="space-y-3"><p className="text-sm text-destructive">계정과 모든 풀이·친구·스터디 데이터가 삭제되며 복구할 수 없습니다.</p><div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={deleting}>취소</Button><Button type="button" variant="destructive" className="flex-1" onClick={deleteAccount} disabled={deleting}>{deleting ? "삭제 중..." : "영구 삭제"}</Button></div></div>}
        </div>
        </section>
      </div>}
    </>
  )
}
