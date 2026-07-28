"use client"

import { Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

const benefits = [
  "크롬 익스텐션으로 풀이 데이터 자동 수집",
  "잔디 그래프로 한눈에 보는 성장 기록",
  "친구들과 스터디룸에서 함께 목표 달성",
]

export default function LoginPage() {
  const [pending, setPending] = useState(false)

  const signInWithGoogle = async () => {
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setPending(false)
      toast.error(error.message)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15">
            <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
              <path d="M4 12h4l2 5 4-10 2 5h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-lg font-semibold">솔브싱크</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-balance text-4xl font-bold leading-tight">
            꾸준함이 실력이 되는
            <br />
            알고리즘 스터디 플랫폼
          </h1>
          <p className="mt-4 text-pretty text-primary-foreground/80 leading-relaxed">
            프로그래머스 풀이 기록을 자동으로 모으고, 친구들과 함께 목표를 향해 달려보세요.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
                  <Check className="size-3" />
                </span>
                <span className="text-sm text-primary-foreground/90">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mini contribution grid decoration */}
        <div className="flex gap-1.5">
          {Array.from({ length: 7 }).map((_, col) => (
            <div key={col} className="flex flex-col gap-1.5">
              {Array.from({ length: 5 }).map((_, row) => (
                <div
                  key={row}
                  className={cn(
                    "size-3 rounded-[3px]",
                    (col * 5 + row) % 3 === 0
                      ? "bg-primary-foreground/70"
                      : (col + row) % 4 === 0
                        ? "bg-primary-foreground/40"
                        : "bg-primary-foreground/15",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold tracking-tight">함께 성장할 준비가 되셨나요?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Google로 시작하고, 스터디 멤버들과 목표를 달성해보세요.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="outline" className="h-11 w-full gap-2" onClick={signInWithGoogle} disabled={pending}>
                <GoogleIcon className="size-4.5" />
                {pending ? "Google로 연결 중..." : "Google로 계속하기"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
