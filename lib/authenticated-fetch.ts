"use client"

import { createClient } from "@/utils/supabase/client"

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`)
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  })
}
