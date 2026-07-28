import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRequestClient } from "@/utils/supabase/request"

const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

export async function POST(request: Request) {
  const supabase = await createRequestClient(request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user) {
    const cookieStore = await cookies()
    console.error("extension token auth failed", { code: userError?.code, message: userError?.message, cookieNames: cookieStore.getAll().map(({ name }) => name) })
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }
  const token = randomBytes(32).toString("base64url")
  const { error } = await supabase.from("extension_connections").upsert({ user_id: user.id, token_hash: hash(token), last_seen_at: null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token })
}

export async function DELETE(request: Request) {
  const supabase = await createRequestClient(request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user) {
    const cookieStore = await cookies()
    console.error("extension disconnect auth failed", { code: userError?.code, message: userError?.message, cookieNames: cookieStore.getAll().map(({ name }) => name) })
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }
  const { error } = await supabase.from("extension_connections").delete().eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
