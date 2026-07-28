"use client"

import { useState } from "react"
import { Check, Clipboard, KeyRound, Puzzle, SearchCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import { completeGettingStartedGuide } from "@/app/actions"
import { Button } from "@/components/ui/button"

const steps = [
  { icon: KeyRound, title: "연동 토큰 발급", description: "아래 버튼을 누르면 내 계정 전용 토큰이 발급되고 자동으로 복사됩니다." },
  { icon: Puzzle, title: "확장 프로그램에 등록", description: "브라우저의 솔브싱크 확장 프로그램을 열고 연동 토큰 입력란에 붙여넣은 뒤 저장하세요." },
  { icon: SearchCheck, title: "연동 확인", description: "프로그래머스에서 문제를 제출하면 대시보드가 ‘연동됨’으로 바뀌고 풀이 기록이 쌓입니다." },
]

export function GettingStartedGuide({ tokenIssued }: { tokenIssued: boolean }) {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(0)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function issueToken() {
    setPending(true)
    try {
      const response = await authenticatedFetch("/api/extension/token", { method: "POST" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "토큰을 발급하지 못했습니다.")
      await navigator.clipboard.writeText(result.token)
      toast.success("연동 토큰을 발급하고 복사했습니다.")
      setStep(1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "토큰을 발급하지 못했습니다.")
    } finally {
      setPending(false)
    }
  }

  async function finish() {
    setPending(true)
    try {
      await completeGettingStartedGuide()
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "안내 완료 상태를 저장하지 못했습니다.")
    } finally {
      setPending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="getting-started-title">
      <div className="w-full max-w-lg rounded-2xl border bg-popover p-5 text-popover-foreground shadow-xl">
        <div>
          <h2 id="getting-started-title" className="text-lg font-semibold">솔브싱크 시작하기</h2>
          <p className="mt-1 text-sm text-muted-foreground">프로그래머스 풀이 기록을 가져오려면 확장 프로그램과 계정을 연결해주세요.</p>
        </div>
        <div className="space-y-3 py-2">
          {steps.map((item, index) => {
            const active = index === step
            const done = index < step
            return <div key={item.title} className={`flex gap-3 rounded-xl border p-4 ${active ? "border-primary/40 bg-primary/5" : "bg-muted/20"}`}><div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="size-4" /> : <item.icon className="size-4" />}</div><div><p className="text-sm font-medium">{index + 1}. {item.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p></div></div>
          })}
          {step === 0 && tokenIssued && <p className="rounded-lg border border-warning-foreground/30 bg-warning-foreground/10 p-3 text-xs leading-relaxed">기존 토큰의 원문은 보안상 다시 확인할 수 없습니다. 새 토큰을 발급하면 기존 토큰 연동은 끊어지고, 새 토큰이 자동으로 복사됩니다.</p>}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={finish} disabled={pending}>나중에 하기</Button>
          {step === 0 && <Button type="button" className="gap-2" onClick={issueToken} disabled={pending}><Clipboard className="size-4" />{pending ? "발급 중..." : tokenIssued ? "새 토큰 발급하고 복사" : "토큰 발급하고 복사"}</Button>}
          {step === 1 && <Button type="button" onClick={() => setStep(2)}>확장 프로그램에 등록했어요</Button>}
          {step === 2 && <Button type="button" onClick={finish} disabled={pending}>{pending ? "저장 중..." : "안내 완료"}</Button>}
        </div>
      </div>
    </div>
  )
}
