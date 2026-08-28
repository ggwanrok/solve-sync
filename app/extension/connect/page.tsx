import { AlertTriangle } from "lucide-react"
import { ExtensionConnectCard } from "@/components/extension-connect-card"
import { Logo } from "@/components/logo"
import {
  isValidCodeChallenge,
  isValidInstallationId,
  isValidState,
  normalizeDeviceName,
  parseExtensionRedirectUri,
} from "@/lib/extension-connect"
import { getViewer, getViewerProfile } from "@/lib/server/viewer"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ExtensionConnectPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const installationId = first(params.installationId)
  const deviceName = normalizeDeviceName(first(params.deviceName))
  const redirect = parseExtensionRedirectUri(first(params.redirectUri))
  const state = first(params.state)
  const codeChallenge = first(params.codeChallenge)
  const valid = isValidInstallationId(installationId)
    && Boolean(deviceName)
    && Boolean(redirect)
    && isValidState(state)
    && isValidCodeChallenge(codeChallenge)
  const [{ user }, profile] = await Promise.all([getViewer(), getViewerProfile()])

  return (
    <main className="flex min-h-screen flex-col bg-background p-5">
      <div className="mx-auto flex w-full max-w-5xl items-center py-2"><Logo /></div>
      <div className="flex flex-1 items-center justify-center py-8">
        {valid && deviceName && redirect ? (
          <ExtensionConnectCard
            signedIn={Boolean(user)}
            accountLabel={profile?.handle ? `${profile.nickname || profile.handle} (@${profile.handle})` : profile?.nickname}
            request={{ installationId, deviceName, redirectUri: redirect.url.toString(), state, codeChallenge }}
          />
        ) : (
          <div className="w-full max-w-md rounded-3xl bg-card p-7 text-center shadow-xl ring-1 ring-foreground/[0.055]">
            <AlertTriangle className="mx-auto size-10 text-destructive" />
            <h1 className="mt-4 text-lg font-semibold">올바르지 않은 연결 요청입니다.</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">SolveSync 확장 프로그램을 다시 열고 계정 연결을 시작해 주세요.</p>
          </div>
        )}
      </div>
    </main>
  )
}
