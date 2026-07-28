import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const requestedNext = url.searchParams.get("next") || "/"
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/"

  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", url.origin))

  const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle()
  return NextResponse.redirect(new URL(profile?.handle ? next : "/onboarding", url.origin))
}
