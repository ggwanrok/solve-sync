"use client"

import { useActionTransition } from "@/lib/use-pending-action"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, LockKeyhole } from "lucide-react"
import { toast } from "sonner"
import { verifyStudyRoomPassword } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function StudyRoomPasswordForm({ studyId, roomName }: { studyId: string; roomName: string }) {
  const [password, setPassword] = useState("")
  const [pending, runAction] = useActionTransition()
  const router = useRouter()

  return (
    <>
      {pending && (
        <div role="status" aria-live="polite" className="app-fade-in fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-8 py-6 shadow-lg">
            <LoaderCircle className="size-7 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">스터디룸에 입장하고 있어요</p>
              <p className="mt-1 text-xs text-muted-foreground">비밀번호를 확인하고 방 정보를 불러오는 중입니다.</p>
            </div>
          </div>
        </div>
      )}
      <Card className="mx-auto w-full max-w-md">
      <CardContent className="flex flex-col items-center p-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><LockKeyhole className="size-5" /></div>
        <h1 className="text-lg font-semibold">비공개 스터디룸</h1>
        <p className="mt-1 text-sm text-muted-foreground">‘{roomName}’의 상세 정보를 보려면 비밀번호를 입력해주세요.</p>
        <form className="mt-6 flex w-full flex-col gap-3" onSubmit={(event) => {
          event.preventDefault()
          if (!password || pending) return
          runAction(async () => {
            try {
              await verifyStudyRoomPassword(studyId, password)
              toast.success("비밀번호가 확인되었습니다.")
              router.refresh()
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "비밀번호를 확인하지 못했습니다.")
            }
          })
        }}>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="방 비밀번호" autoFocus disabled={pending} aria-busy={pending} />
          <Button type="submit" disabled={pending || !password}>{pending ? "확인 중..." : "확인하고 둘러보기"}</Button>
        </form>
      </CardContent>
      </Card>
    </>
  )
}
