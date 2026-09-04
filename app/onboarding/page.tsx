"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, LoaderCircle, Search } from "lucide-react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePendingAction, useActionTransition } from "@/lib/use-pending-action"
import { createClient } from "@/utils/supabase/client"

export default function OnboardingPage() {
  const router = useRouter()
  const [handle, setHandle] = useState("")
  const [checkedHandle, setCheckedHandle] = useState<string | null>(null)
  const [availabilityMessage, setAvailabilityMessage] = useState("")
  const { pending: checking, start: startChecking, finish: finishChecking } = usePendingAction()
  const [pending, runSubmit] = useActionTransition()

  const normalizedHandle = handle
  const isValidHandle = /^[a-z0-9_]{3,20}$/.test(normalizedHandle)
  const isAvailable = checkedHandle === normalizedHandle

  const checkAvailability = async () => {
    if (!isValidHandle) {
      setCheckedHandle(null)
      setAvailabilityMessage("영문 소문자, 숫자, 밑줄을 사용해 3~20자로 입력해주세요.")
      return
    }

    if (pending || !startChecking()) return
    setAvailabilityMessage("")
    try {
      const { data, error } = await createClient().rpc("is_handle_available", { desired_handle: normalizedHandle })
      if (error) throw error
      setCheckedHandle(data ? normalizedHandle : null)
      setAvailabilityMessage(data ? "사용할 수 있는 아이디입니다." : "이미 사용 중인 아이디입니다.")
    } catch (error) {
      setCheckedHandle(null)
      setAvailabilityMessage(error instanceof Error ? error.message : "사용 가능 여부를 확인하지 못했습니다.")
    } finally {
      finishChecking()
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAvailable || checking) return
    runSubmit(async () => {
      try {
        const { error } = await createClient().rpc("claim_handle", { desired_handle: normalizedHandle })
        if (error) throw error
        router.replace("/")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "아이디를 설정하지 못했습니다.")
      }
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-8 py-6 shadow-xl ring-1 ring-foreground/[0.055]">
            <LoaderCircle className="size-7 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">아이디를 설정하고 있어요</p>
              <p className="mt-1 text-xs text-muted-foreground">잠시만 기다려주세요.</p>
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-md rounded-3xl bg-card p-7 shadow-[0_16px_60px_rgba(15,23,42,0.07)] ring-1 ring-foreground/[0.055] sm:p-9">
        <Logo />
        <div className="mt-8">
          <h1 className="text-2xl font-bold tracking-[-0.035em]">사용할 아이디를 설정해주세요.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            친구 검색에 사용하는 고유한 아이디이며, 생성 후에는 변경할 수 없습니다.
          </p>
        </div>
        <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="handle">아이디</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="handle"
                  disabled={checking || pending}
                  value={handle}
                  onChange={(event) => {
                    setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    setCheckedHandle(null)
                    setAvailabilityMessage("")
                  }}
                  placeholder="algo_rookie"
                  minLength={3}
                  maxLength={20}
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={checkAvailability} disabled={checking || pending || !handle} aria-busy={checking} className="gap-1.5">
                {checking ? "확인 중" : "중복 확인"}
                {!checking && <Search className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">영문 소문자, 숫자, 밑줄 3~20자</p>
            {availabilityMessage && (
              <p className={`flex items-center gap-1 text-xs ${isAvailable ? "text-primary" : "text-destructive"}`}>
                {isAvailable && <Check className="size-3.5" />}
                {availabilityMessage}
              </p>
            )}
          </div>
          <Button type="submit" disabled={pending || !isAvailable} className="gap-2">
            {pending ? "확정 중..." : "아이디 확정"}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </div>
    </main>
  )
}
