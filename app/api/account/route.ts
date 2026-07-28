import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  const { error } = await supabase.rpc("delete_own_account")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
