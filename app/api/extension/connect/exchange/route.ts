import { createHash, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { isValidCodeVerifier, isValidInstallationId } from "@/lib/extension-connect"
import { createAdminClient } from "@/utils/supabase/admin"

export const runtime = "nodejs"

const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

export async function POST(request: Request) {
  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 요청이 필요합니다." }, { status: 400 })
  }

  const code = typeof input.code === "string" ? input.code : ""
  const verifier = input.codeVerifier
  const installationId = input.installationId
  if (code.length < 32 || code.length > 180 || !/^[A-Za-z0-9_-]+$/.test(code) || !isValidCodeVerifier(verifier) || !isValidInstallationId(installationId)) {
    return NextResponse.json({ error: "유효하지 않은 연결 코드입니다." }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const token = randomBytes(32).toString("base64url")
  const { data, error } = await admin.rpc("exchange_extension_connection_code", {
    presented_code_hash: hash(code),
    presented_code_challenge: hash(verifier),
    presented_installation_id: installationId,
    issued_token_hash: hash(token),
  })
  if (error || !data) {
    if (error) console.error("extension connection code exchange failed", error)
    return NextResponse.json({ error: "연결 코드가 만료되었거나 이미 사용되었습니다. 다시 연결해 주세요." }, { status: 401 })
  }

  return NextResponse.json({
    token,
    installationId: data.installationId,
    deviceName: data.deviceName,
    connectedAt: data.connectedAt,
  })
}
