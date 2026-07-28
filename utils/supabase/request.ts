import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"

export async function createRequestClient(request: Request) {
  const authorization = request.headers.get("authorization")

  if (authorization?.startsWith("Bearer ")) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization } },
      },
    )
  }

  return createServerClient()
}
