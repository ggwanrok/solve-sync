import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/utils/supabase/server"

function safeNextPath(value: string | null, origin: string) {
  if (!value) return null

  try {
    const target = new URL(value, origin)
    if (target.origin !== origin || target.pathname !== "/extension/connect") return null
    return `${target.pathname}${target.search}`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), request.nextUrl.origin)

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error("OAuth callback failed", { code: error?.code, message: error?.message })
    return NextResponse.redirect(new URL("/login?error=callback_failed", request.url))
  }

  if (next) {
    return NextResponse.redirect(new URL(next, request.url))
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", data.user.id)
    .maybeSingle()

  return NextResponse.redirect(new URL(profile?.handle ? "/" : "/onboarding", request.url))
}
