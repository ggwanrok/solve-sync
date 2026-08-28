"use client"

import { Plus, Minus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createStudyRoom } from "@/app/actions"
import { DIFFICULTY_LEVELS, minimumDifficultyLabel, type DifficultyLevel } from "@/lib/difficulty"

export function CreateStudyDialog() {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState<"일" | "주">("주")
  const [count, setCount] = useState(5)
  const [minDifficulty, setMinDifficulty] = useState<DifficultyLevel>(0)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("스터디룸 이름을 입력해주세요.")
      return
    }
    if (isPrivate && password.length < 8) {
      toast.error("비공개방 비밀번호는 8자 이상 입력해주세요.")
      return
    }
    setPending(true)
    try {
      await createStudyRoom({
        name: name.trim(),
        description: description.trim(),
        goalPeriod: unit === "일" ? "daily" : "weekly",
        goalCount: count,
        minDifficulty,
        password: isPrivate ? password : null,
      })
      toast.success(`'${name.trim()}' 스터디룸을 만들었어요!`)
      setOpen(false); setName(""); setDescription(""); setCount(5); setMinDifficulty(0); setUnit("주"); setIsPrivate(false); setPassword("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "스터디룸을 만들지 못했어요.")
    } finally { setPending(false) }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ className: "gap-2" })}>
        <Plus className="size-4" />
        스터디룸 만들기
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>새 스터디룸 만들기</DialogTitle>
          <DialogDescription>스터디 규칙을 정하고 친구들을 초대해보세요.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label>스터디룸 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 코테 마스터" />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="desc">소개</Label>
            <Input id="desc" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="스터디를 한 줄로 소개해주세요." />
          </div>

          {/* Rule selector */}
          <div className="flex flex-col gap-2">
            <Label>스터디 규칙</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/55 p-3">
              <Select value={unit} onValueChange={(v) => setUnit(v as "일" | "주")}>
                <SelectTrigger className="w-24 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="일">매일</SelectItem>
                  <SelectItem value="주">매주</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">당</span>
              <div className="flex items-center rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-r-none"
                  aria-label="줄이기"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-10 text-center font-mono text-sm font-medium">{count}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-l-none"
                  aria-label="늘리기"
                  onClick={() => setCount((c) => Math.min(50, c + 1))}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">문제씩</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{unit === "일" ? "매일" : "매주"}</span> 최소{" "}
              <span className="font-medium text-primary">{count}문제</span>를 풀어야 해요.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="min-difficulty">난이도 수준</Label>
            <Select value={String(minDifficulty)} onValueChange={(value) => setMinDifficulty(Number(value) as DifficultyLevel)}>
              <SelectTrigger id="min-difficulty" className="w-full bg-background">
                <SelectValue>{minimumDifficultyLabel(minDifficulty)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_LEVELS.map((level) => (
                  <SelectItem key={level} value={String(level)}>{minimumDifficultyLabel(level)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              프로그래머스 <span className="font-medium text-foreground">Lv.{minDifficulty} 이상</span> 문제만 목표에 반영돼요.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>공개 설정</Label>
            <button type="button" onClick={() => { setIsPrivate((value) => !value); setPassword("") }} className="flex items-center justify-between rounded-2xl bg-muted/55 p-4 text-left transition-colors hover:bg-muted">
              <div><p className="text-sm font-medium">비공개 스터디룸</p><p className="text-xs text-muted-foreground">참여할 때 비밀번호가 필요합니다.</p></div>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${isPrivate ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${isPrivate ? "translate-x-6" : "translate-x-1"}`} /></span>
            </button>
            {isPrivate && <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호 8자 이상" minLength={8} maxLength={50} autoComplete="new-password" />}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={handleCreate} disabled={pending}>{pending ? "만드는 중..." : "스터디룸 만들기"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
