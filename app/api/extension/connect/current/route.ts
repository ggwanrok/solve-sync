import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"

export const runtime = "nodejs"

const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

export async function DELETE(request: Request) {
  const authorization = request.headers.get("authorization") || ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!token) return NextResponse.json({ error: "연결 정보가 필요합니다." }, { status: 401 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })
  const { error, count } = await admin
    .from("extension_connections")
    .delete({ count: "exact" })
    .eq("token_hash", hash(token))
  if (error) return NextResponse.json({ error: "기기 연결을 해제하지 못했습니다." }, { status: 500 })
  if (!count) return NextResponse.json({ error: "이미 해제된 연결입니다." }, { status: 401 })
  return NextResponse.json({ ok: true })
}
