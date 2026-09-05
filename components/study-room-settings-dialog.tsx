"use client"

import { useState } from "react"
import { Globe2, LoaderCircle, LockKeyhole, Settings2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateStudyRoomSettings } from "@/app/study-room-settings-actions"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActionTransition } from "@/lib/use-pending-action"

export function StudyRoomSettingsDialog({
  studyId,
  initialName,
  initialDescription,
  initialIsPrivate,
}: {
  studyId: string
  initialName: string
  initialDescription: string
  initialIsPrivate: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate)
  const [password, setPassword] = useState("")
  const [pending, runSave] = useActionTransition()
  const router = useRouter()
  const trimmedName = name.trim()
  const trimmedDescription = description.trim()
  const requiresPassword = !initialIsPrivate && isPrivate
  const changed = trimmedName !== initialName || trimmedDescription !== initialDescription || isPrivate !== initialIsPrivate

  function resetForm() {
    setName(initialName)
    setDescription(initialDescription)
    setIsPrivate(initialIsPrivate)
    setPassword("")
  }

  function save() {
    if (!trimmedName) {
      toast.error("스터디룸 이름을 입력해 주세요.")
      return
    }
    if (Array.from(trimmedName).length > 30) {
      toast.error("스터디룸 이름은 30자 이하로 입력해 주세요.")
      return
    }
    if (Array.from(trimmedDescription).length > 100) {
      toast.error("소개는 100자 이하로 입력해 주세요.")
      return
    }
    if (requiresPassword && (password.length < 8 || password.length > 50)) {
      toast.error("비공개방 비밀번호는 8~50자로 입력해 주세요.")
      return
    }

    runSave(async () => {
      try {
        const result = await updateStudyRoomSettings({
          studyId,
          name: trimmedName,
          description: trimmedDescription,
          isPrivate,
          password: requiresPassword ? password : null,
        })
        if (!result.ok) {
          toast.error(result.message)
          return
        }
        toast.success("스터디룸 설정을 저장했습니다.")
        setOpen(false)
        setPassword("")
        router.refresh()
      } catch {
        toast.error("스터디룸 설정을 저장하지 못했습니다. 다시 시도해 주세요.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (pending) return
        if (value) resetForm()
        setOpen(value)
      }}
    >
      <DialogTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
        <Settings2 className="size-4" />방 설정
      </DialogTrigger>
      <DialogContent showCloseButton={!pending} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>스터디룸 설정</DialogTitle>
          <DialogDescription>방 이름과 소개, 공개 여부만 변경할 수 있습니다. 목표와 난이도는 기존 기록을 위해 유지됩니다.</DialogDescription>
        </DialogHeader>

        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5 py-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="study-room-settings-name">스터디룸 이름</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{Array.from(name).length}/30</span>
            </div>
            <Input id="study-room-settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={30} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="study-room-settings-description">방 설명</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{Array.from(description).length}/100</span>
            </div>
            <Input id="study-room-settings-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={100} placeholder="스터디를 한 줄로 소개해 주세요." />
          </div>

          <div className="flex flex-col gap-2">
            <Label>공개 설정</Label>
            <button
              type="button"
              role="switch"
              aria-checked={isPrivate}
              onClick={() => {
                setIsPrivate((value) => !value)
                setPassword("")
              }}
              className="flex items-center justify-between gap-4 rounded-2xl bg-muted/55 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-sm">
                  {isPrivate ? <LockKeyhole className="size-4" /> : <Globe2 className="size-4" />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{isPrivate ? "비공개 스터디룸" : "공개 스터디룸"}</span>
                  <span className="block text-xs text-muted-foreground">{isPrivate ? "참여할 때 비밀번호가 필요합니다." : "누구나 방 정보를 보고 참여할 수 있습니다."}</span>
                </span>
              </span>
              <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isPrivate ? "bg-primary" : "bg-muted"}`}>
                <span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${isPrivate ? "translate-x-6" : "translate-x-1"}`} />
              </span>
            </button>

            {requiresPassword && (
              <div className="mt-1 flex flex-col gap-2">
                <Label htmlFor="study-room-settings-password">입장 비밀번호</Label>
                <Input id="study-room-settings-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={50} autoComplete="new-password" placeholder="8~50자" />
              </div>
            )}
            {initialIsPrivate && isPrivate && <p className="text-xs text-muted-foreground">기존 입장 비밀번호는 그대로 유지됩니다.</p>}
            {initialIsPrivate && !isPrivate && <p className="text-xs text-muted-foreground">공개로 저장하면 기존 입장 비밀번호가 폐기됩니다.</p>}
          </div>
        </fieldset>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>취소</Button>
          <Button type="button" disabled={pending || !changed || (requiresPassword && password.length < 8)} aria-busy={pending} onClick={save}>
            {pending && <LoaderCircle className="animate-spin" />}
            {pending ? "저장 중…" : "변경사항 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
