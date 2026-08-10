import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"

export async function createRequestClient(request: Request) {
  const authorization = request.headers.get("authorization")
  const headerAccessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined

  if (headerAccessToken) {
    return {
      supabase: createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${headerAccessToken}` } },
        },
      ),
      accessToken: headerAccessToken,
    }
  }

  return { supabase: await createServerClient(), accessToken: undefined }
}
