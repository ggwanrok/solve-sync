"use client"

import { CheckCircle2, Chrome, LoaderCircle, ShieldCheck, X } from "lucide-react"
import { usePendingAction } from "@/lib/use-pending-action"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import { MAX_EXTENSION_CONNECTIONS } from "@/lib/extension-connect"
import { createClient } from "@/utils/supabase/client"

type ConnectRequest = {
  installationId: string
  deviceName: string
  redirectUri: string
  state: string
  codeChallenge: string
}

export function ExtensionConnectCard({ request, signedIn, accountLabel }: { request: ConnectRequest; signedIn: boolean; accountLabel?: string | null }) {
  const { pending, start, finish } = usePendingAction()

  function connectionPath() {
    const params = new URLSearchParams({
      installationId: request.installationId,
      deviceName: request.deviceName,
      redirectUri: request.redirectUri,
      state: request.state,
      codeChallenge: request.codeChallenge,
    })
    return `/extension/connect?${params.toString()}`
  }

  async function signIn() {
    if (!start()) return
    try {
      const callback = new URL("/auth/callback", window.location.origin)
      callback.searchParams.set("next", connectionPath())
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      })
      if (error) throw error
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "로그인 화면을 열지 못했습니다.")
      finish()
    }
  }

  async function approve() {
    if (!start()) return
    try {
      const response = await authenticatedFetch("/api/extension/connect/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "기기 연결을 승인하지 못했습니다.")
      window.location.replace(result.redirectUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "기기 연결을 승인하지 못했습니다.")
      finish()
    }
  }

  function cancel() {
    if (!start()) return
    const callback = new URL(request.redirectUri)
    callback.searchParams.set("error", "access_denied")
    callback.searchParams.set("state", request.state)
    window.location.replace(callback.toString())
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-card p-7 text-card-foreground shadow-[0_20px_70px_rgba(15,23,42,0.1)] ring-1 ring-foreground/[0.055]">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Chrome className="size-6" />
      </div>
      <h1 className="mt-5 text-xl font-semibold">SolveSync 확장 프로그램 연결</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        이 기기에서 수집한 프로그래머스 풀이를 현재 SolveSync 계정에 동기화합니다.
      </p>

      <div className="mt-5 rounded-2xl bg-muted/55 p-4">
        <p className="text-xs text-muted-foreground">연결할 기기</p>
        <p className="mt-1 font-medium">{request.deviceName}</p>
        <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>기기마다 별도 키를 발급합니다. 다른 기기의 연결에는 영향을 주지 않으며, 마이페이지에서 개별 해제할 수 있습니다.</span>
        </div>
      </div>

      {signedIn ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="size-4" />
            {accountLabel ? `${accountLabel} 계정으로 로그인했습니다.` : "SolveSync 로그인이 확인되었습니다."}
          </div>
          <Button type="button" className="w-full" onClick={approve} disabled={pending}>
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {pending ? "연결 승인 중..." : "이 기기 연결 승인"}
          </Button>
        </div>
      ) : (
        <Button type="button" className="mt-5 w-full" onClick={signIn} disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {pending ? "Google 로그인 여는 중..." : "Google로 로그인하고 연결"}
        </Button>
      )}
      <Button type="button" variant="ghost" className="mt-2 w-full" onClick={cancel} disabled={pending}>
        <X className="size-4" />연결 취소
      </Button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        계정당 최대 {MAX_EXTENSION_CONNECTIONS}개까지 연결할 수 있습니다. 승인 코드는 5분 동안 한 번만 사용되며, 로그인 정보는 확장 프로그램에 전달되지 않습니다.
      </p>
    </div>
  )
}
