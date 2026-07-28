"use client"

import { KeyRound, LogOut, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export type AccountUser = {
  name: string
  handle: string
  extensionConnected?: boolean
  extensionTokenCreatedAt?: string | null
  extensionLastSeenAt?: string | null
}

export function AccountDialog({ user }: { user: AccountUser }) {
  const router = useRouter()
  const [issuing, setIssuing] = useState(false)
  const [confirmReissue, setConfirmReissue] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const issueToken = async () => {
    setIssuing(true)
    const response = await fetch("/api/extension/token", { method: "POST" })
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
      const response = await fetch("/api/account", { method: "DELETE" })
      const result = await response.json()
      if (!response.ok) return toast.error(result.error || "탈퇴 처리에 실패했습니다.")
      window.location.replace("/login")
    } catch {
      toast.error("탈퇴 요청을 완료하지 못했습니다. 네트워크 상태를 확인해 주세요.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<button className="rounded-full outline-none ring-ring focus-visible:ring-2" aria-label="마이페이지 열기" />}>
        <UserAvatar name={user.name} className="size-9" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>마이페이지</DialogTitle><DialogDescription>계정과 익스텐션 연동 정보를 관리합니다.</DialogDescription></DialogHeader>
        <div className="flex items-center gap-3 rounded-xl border p-4"><UserAvatar name={user.name} className="size-11" /><div><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">고유 닉네임 · {user.handle}</p></div></div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between"><div><p className="text-sm font-medium">익스텐션 {user.extensionConnected ? "연동됨" : "미연동"}</p><p className="mt-1 text-xs text-muted-foreground">{user.extensionLastSeenAt ? `마지막 통신 ${new Date(user.extensionLastSeenAt).toLocaleString("ko-KR")}` : user.extensionTokenCreatedAt ? `토큰 발급 ${new Date(user.extensionTokenCreatedAt).toLocaleString("ko-KR")}` : "발급된 토큰이 없습니다."}</p></div><KeyRound className="size-5 text-muted-foreground" /></div>
          {confirmReissue ? <div className="mt-3 rounded-lg border border-warning-foreground/30 bg-warning-foreground/10 p-3"><p className="text-xs leading-relaxed">재발급하면 기존 토큰과의 연동이 즉시 끊어집니다. 익스텐션에 새 토큰을 다시 등록해야 합니다.</p><div className="mt-3 flex gap-2"><Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setConfirmReissue(false)}>취소</Button><Button type="button" size="sm" className="flex-1" onClick={issueToken} disabled={issuing}>{issuing ? "재발급 중..." : "재발급"}</Button></div></div> : <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => user.extensionTokenCreatedAt ? setConfirmReissue(true) : issueToken()} disabled={issuing}>{issuing ? "발급 중..." : user.extensionTokenCreatedAt ? "연동 토큰 재발급" : "연동 토큰 발급"}</Button>}
        </div>
        <Button render={<Link href="/auth/signout" />} nativeButton={false} variant="outline" className="w-full"><LogOut className="size-4" />로그아웃</Button>
        <div className="rounded-xl border border-destructive/30 p-4">
          {!confirmDelete ? <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />회원 탈퇴</Button> : <div className="space-y-3"><p className="text-sm text-destructive">계정과 모든 풀이·친구·스터디 데이터가 삭제되며 복구할 수 없습니다.</p><div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={deleting}>취소</Button><Button type="button" variant="destructive" className="flex-1" onClick={deleteAccount} disabled={deleting}>{deleting ? "삭제 중..." : "영구 삭제"}</Button></div></div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
