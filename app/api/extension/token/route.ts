import { createHash, randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

const hash = (value: string) => createHash("sha256").update(value).digest("base64url")

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  const token = randomBytes(32).toString("base64url")
  const { error } = await supabase.from("extension_connections").upsert({ user_id: user.id, token_hash: hash(token), last_seen_at: null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  const { error } = await supabase.from("extension_connections").delete().eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
