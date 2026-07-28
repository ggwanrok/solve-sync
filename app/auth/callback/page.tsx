"use client"

import { LoaderCircle } from "lucide-react"
import { useEffect, useRef } from "react"
import { Logo } from "@/components/logo"
import { createClient } from "@/utils/supabase/client"

export default function AuthCallbackPage() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function completeSignIn() {
      const code = new URLSearchParams(window.location.search).get("code")
      if (!code) {
        window.location.replace("/login?error=missing_code")
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        window.location.replace(`/login?error=${encodeURIComponent(error.message)}`)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.replace("/login?error=session_missing")
        return
      }

      const sessionResponse = await fetch("/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      })

      if (!sessionResponse.ok) {
        window.location.replace("/login?error=server_session_failed")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", session.user.id)
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
