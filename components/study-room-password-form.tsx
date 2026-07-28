"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LockKeyhole } from "lucide-react"
import { toast } from "sonner"
import { verifyStudyRoomPassword } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function StudyRoomPasswordForm({ studyId, roomName }: { studyId: string; roomName: string }) {
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const router = useRouter()

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="flex flex-col items-center p-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><LockKeyhole className="size-5" /></div>
        <h1 className="text-lg font-semibold">비공개 스터디룸</h1>
        <p className="mt-1 text-sm text-muted-foreground">‘{roomName}’의 상세 정보를 보려면 비밀번호를 입력해주세요.</p>
        <form className="mt-6 flex w-full flex-col gap-3" onSubmit={async (event) => {
          event.preventDefault()
          if (!password || pending) return
          setPending(true)
          try {
            await verifyStudyRoomPassword(studyId, password)
            toast.success("비밀번호가 확인되었습니다.")
            router.refresh()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "비밀번호를 확인하지 못했습니다.")
          } finally {
            setPending(false)
          }
        }}>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="방 비밀번호" autoFocus />
          <Button type="submit" disabled={pending || !password}>{pending ? "확인 중..." : "확인하고 둘러보기"}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
