import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

type SessionPayload = {
  access_token?: string
  refresh_token?: string
}

export async function POST(request: NextRequest) {
  let payload: SessionPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "잘못된 세션 요청입니다." }, { status: 400 })
  }

  if (!payload.access_token || !payload.refresh_token) {
    return NextResponse.json({ error: "로그인 세션 정보가 없습니다." }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })

  if (error || !data.user) {
    return NextResponse.json({ error: "서버 로그인 세션을 만들지 못했습니다." }, { status: 401 })
  }

  return response
}
