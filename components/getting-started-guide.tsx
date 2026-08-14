"use client"

import { useState } from "react"
import { Check, Chrome, LogIn, SearchCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { completeGettingStartedGuide } from "@/app/actions"
import { Button } from "@/components/ui/button"

const steps = [
  { icon: Chrome, title: "확장 프로그램 열기", description: "Chrome 도구 모음에서 SolveSync 확장 프로그램을 열고 ‘SolveSync 계정 연결’을 누르세요." },
  { icon: LogIn, title: "로그인하고 기기 승인", description: "열린 화면에서 Google로 로그인한 뒤 이 기기 연결을 승인하세요. 토큰을 복사하거나 붙여 넣을 필요가 없습니다." },
  { icon: SearchCheck, title: "연동 확인", description: "프로그래머스에서 문제를 제출하면 대시보드에 풀이 기록이 쌓입니다. 여러 PC는 각 PC에서 한 번씩 같은 방식으로 연결하세요." },
]

export function GettingStartedGuide({ deviceConnected }: { deviceConnected: boolean }) {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(deviceConnected ? 2 : 0)
  const [pending, setPending] = useState(false)
  const router = useRouter()

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
          <p className="mt-1 text-sm text-muted-foreground">프로그래머스 풀이 기록을 가져오려면 이 브라우저의 확장 프로그램을 계정에 연결해 주세요.</p>
        </div>
        <div className="space-y-3 py-2">
          {steps.map((item, index) => {
            const active = index === step
            const done = index < step
            return <div key={item.title} className={`flex gap-3 rounded-xl border p-4 ${active ? "border-primary/40 bg-primary/5" : "bg-muted/20"}`}><div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="size-4" /> : <item.icon className="size-4" />}</div><div><p className="text-sm font-medium">{index + 1}. {item.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p></div></div>
          })}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={finish} disabled={pending}>나중에 하기</Button>
          {step === 0 && <Button type="button" onClick={() => setStep(1)}>확장 프로그램을 열었어요</Button>}
          {step === 1 && <Button type="button" onClick={() => setStep(2)}>기기 연결을 완료했어요</Button>}
          {step === 2 && <Button type="button" onClick={finish} disabled={pending}>{pending ? "저장 중..." : "안내 완료"}</Button>}
        </div>
      </div>
    </div>
  )
}
