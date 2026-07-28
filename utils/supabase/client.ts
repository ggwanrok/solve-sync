import { createClient as createSupabaseClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth-cookies"

let browserClient: SupabaseClient | undefined

function syncSessionCookies(session: Session | null) {
  if (typeof document === "undefined") return

  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  if (!session) {
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    document.cookie = `${REFRESH_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    return
  }

  document.cookie = `${ACCESS_TOKEN_COOKIE}=${session.access_token}; Path=/; Max-Age=${session.expires_in}; SameSite=Lax${secure}`
  document.cookie = `${REFRESH_TOKEN_COOKIE}=${session.refresh_token}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
}

export function createClient() {
  if (browserClient) return browserClient

  browserClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    },
  )

  browserClient.auth.onAuthStateChange((_event, session) => {
    syncSessionCookies(session)
  })

  return browserClient
}
