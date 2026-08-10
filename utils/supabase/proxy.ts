import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth-cookies"

function redirectWithCookies(request: NextRequest, pathname: string, response: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export async function updateSession(request: NextRequest) {
  const oauthCode = request.nextUrl.searchParams.get("code")
  if (oauthCode && request.nextUrl.pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone()
    callbackUrl.pathname = "/auth/callback"
    callbackUrl.search = ""
    callbackUrl.searchParams.set("code", oauthCode)
    return NextResponse.redirect(callbackUrl)
  }

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

  const legacyAccessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const legacyRefreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  let { data } = await supabase.auth.getClaims()

  // 이전 버전의 이중 저장 세션은 SSR 쿠키로 한 번 이관한 뒤 제거합니다.
  if (!data?.claims && legacyAccessToken && legacyRefreshToken) {
    const { data: restored } = await supabase.auth.setSession({
      access_token: legacyAccessToken,
      refresh_token: legacyRefreshToken,
    })
    if (restored.session) ({ data } = await supabase.auth.getClaims())
  }

  if (legacyAccessToken) response.cookies.delete(ACCESS_TOKEN_COOKIE)
  if (legacyRefreshToken) response.cookies.delete(REFRESH_TOKEN_COOKIE)

  const isPublic = request.nextUrl.pathname === "/about" || request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth")
  const isApi = request.nextUrl.pathname.startsWith("/api/")

  // API Route Handler는 자체적으로 인증하고 JSON 401을 반환한다. 여기서 /login으로
  // 리디렉션하면 POST/DELETE 메서드가 유지되어 /login에서 405가 발생한다.
  if (!data?.claims && !isPublic && !isApi) {
    return redirectWithCookies(request, "/login", response)
  }

  if (data?.claims && request.nextUrl.pathname === "/login") {
    return redirectWithCookies(request, "/", response)
  }

  return response
}
