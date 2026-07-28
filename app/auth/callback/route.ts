import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, authCookieOptions } from "@/lib/auth-cookies"

type PendingCookie = {
  name: string
  value: string
  options: CookieOptions
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url))
  }

  const pendingCookies: PendingCookie[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    },
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error("OAuth callback failed", { code: error?.code, message: error?.message })
    return NextResponse.redirect(new URL("/login?error=callback_failed", request.url))
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", data.user.id)
    .maybeSingle()

  const response = NextResponse.redirect(
    new URL(profile?.handle ? "/" : "/onboarding", request.url),
  )

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  if (data.session) {
    response.cookies.set(ACCESS_TOKEN_COOKIE, data.session.access_token, {
      ...authCookieOptions,
      maxAge: data.session.expires_in,
    })
    response.cookies.set(REFRESH_TOKEN_COOKIE, data.session.refresh_token, {
      ...authCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  return response
}
