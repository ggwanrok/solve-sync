"use client"

import { LoaderCircle } from "lucide-react"
import { useEffect, useRef } from "react"
import { Logo } from "@/components/logo"
import { createClient } from "@/utils/supabase/client"

function safeNextPath(value: string | null) {
  if (!value) return null
  try {
    const target = new URL(value, window.location.origin)
    if (target.origin !== window.location.origin || target.pathname !== "/extension/connect") return null
    return `${target.pathname}${target.search}`
  } catch {
    return null
  }
}

export default function AuthCallbackPage() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function completeSignIn() {
      const code = new URLSearchParams(window.location.search).get("code")
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"))
      if (!code) {
        window.location.replace("/login?error=missing_code")
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error || !data.session) {
        window.location.replace(`/login?error=${encodeURIComponent(error?.message || "session_missing")}`)
        return
      }

      if (next) {
        window.location.replace(next)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", data.session.user.id)
        .maybeSingle()

      window.location.replace(profile?.handle ? "/" : "/onboarding")
    }

    void completeSignIn()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <Logo />
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <div>
          <p className="font-medium">로그인을 완료하고 있어요.</p>
          <p className="mt-1 text-sm text-muted-foreground">잠시만 기다려주세요.</p>
        </div>
      </div>
    </main>
  )
}
