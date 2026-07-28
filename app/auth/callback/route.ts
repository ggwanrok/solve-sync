import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type PendingCookie = { name: string; value: string; options: CookieOptions }

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const requestedNext = url.searchParams.get("next") || "/"
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/"

  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin))

  const cookieStore = await cookies()
  const pendingCookies: PendingCookie[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", url.origin))

  const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle()
  const response = NextResponse.redirect(new URL(profile?.handle ? next : "/onboarding", url.origin))
  pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
