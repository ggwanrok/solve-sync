import { createHash, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import {
  CONNECTION_CODE_TTL_MS,
  EXTENSION_CONNECTION_LIMIT_MESSAGE,
  canConnectExtensionInstallation,
  isValidCodeChallenge,
  isValidInstallationId,
  isValidState,
  normalizeDeviceName,
  parseExtensionRedirectUri,
} from "@/lib/extension-connect"
import { createAdminClient } from "@/utils/supabase/admin"
import { createRequestClient } from "@/utils/supabase/request"

export const runtime = "nodejs"

const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

export async function POST(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 요청이 필요합니다." }, { status: 400 })
  }

  const installationId = input.installationId
  const deviceName = normalizeDeviceName(input.deviceName)
  const redirect = parseExtensionRedirectUri(input.redirectUri)
  const state = input.state
  const codeChallenge = input.codeChallenge
  if (!isValidInstallationId(installationId) || !deviceName || !redirect || !isValidState(state) || !isValidCodeChallenge(codeChallenge)) {
    return NextResponse.json({ error: "유효하지 않은 기기 연결 요청입니다." }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const { data: connections, error: connectionError } = await admin
    .from("extension_connections")
    .select("installation_id")
    .eq("user_id", user.id)
  if (connectionError) {
    console.error("extension connection limit check failed", connectionError)
    return NextResponse.json({ error: "연결된 기기를 확인하지 못했습니다." }, { status: 500 })
  }
  if (!canConnectExtensionInstallation((connections || []).map((connection) => connection.installation_id), installationId)) {
    return NextResponse.json({ error: EXTENSION_CONNECTION_LIMIT_MESSAGE }, { status: 409 })
  }

  const code = randomBytes(32).toString("base64url")
  const now = new Date()
  await admin
    .from("extension_connection_codes")
    .delete()
    .lt("expires_at", now.toISOString())
  await admin
    .from("extension_connection_codes")
    .delete()
    .eq("user_id", user.id)
    .eq("installation_id", installationId)
    .is("used_at", null)

  const { error } = await admin.from("extension_connection_codes").insert({
    user_id: user.id,
    installation_id: installationId,
    device_name: deviceName,
    code_hash: hash(code),
    code_challenge: codeChallenge,
    redirect_uri: redirect.url.toString(),
    expires_at: new Date(now.getTime() + CONNECTION_CODE_TTL_MS).toISOString(),
  })
  if (error) {
    console.error("extension connection authorization failed", error)
    return NextResponse.json({ error: "기기 연결을 승인하지 못했습니다." }, { status: 500 })
  }

  const callbackUrl = new URL(redirect.url)
  callbackUrl.searchParams.set("code", code)
  callbackUrl.searchParams.set("state", state)
  return NextResponse.json({ redirectUrl: callbackUrl.toString() })
}
