import { NextResponse } from "next/server"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth-cookies"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.delete(ACCESS_TOKEN_COOKIE)
  response.cookies.delete(REFRESH_TOKEN_COOKIE)
  return response
}
