import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: "서버 설정이 완료되지 않았습니다." }, { status: 503 })

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })

  const response = NextResponse.json({ ok: true })
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) {
      response.cookies.delete(cookie.name)
    }
  }
  return response
}
