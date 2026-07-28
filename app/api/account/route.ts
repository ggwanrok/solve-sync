import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  const { error } = await supabase.rpc("delete_own_account")
  if (error) {
    console.error("delete_own_account failed", { code: error.code, details: error.details, hint: error.hint, message: error.message })
    return NextResponse.json({ error: "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) {
      response.cookies.delete(cookie.name)
    }
  }
  return response
}
