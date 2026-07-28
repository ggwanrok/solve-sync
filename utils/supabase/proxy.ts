import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, authCookieOptions } from "@/lib/auth-cookies"

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  const hasSupabaseSession = request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"))

  if (!hasSupabaseSession && accessToken && refreshToken) {
    const { data: restored } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (restored.session) {
      response.cookies.set(ACCESS_TOKEN_COOKIE, restored.session.access_token, {
        ...authCookieOptions,
        maxAge: restored.session.expires_in,
      })
      response.cookies.set(REFRESH_TOKEN_COOKIE, restored.session.refresh_token, {
        ...authCookieOptions,
        maxAge: 60 * 60 * 24 * 30,
      })
    }
  }

  const { data } = await supabase.auth.getClaims(accessToken)
  const isPublic = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth")
  const isApi = request.nextUrl.pathname.startsWith("/api/")

  // API Route Handler는 자체적으로 인증하고 JSON 401을 반환한다. 여기서 /login으로
  // 리디렉션하면 POST/DELETE 메서드가 유지되어 /login에서 405가 발생한다.
  if (!data?.claims && !isPublic && !isApi) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (data?.claims && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return response
}
