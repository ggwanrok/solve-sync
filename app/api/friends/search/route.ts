import { NextResponse } from "next/server"
import { createRequestClient } from "@/utils/supabase/request"

export async function GET(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  const rawQuery = new URL(request.url).searchParams.get("q") || ""
  const query = rawQuery.trim().toLowerCase().replace(/^@+/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20)
  if (!query) return NextResponse.json({ profiles: [] })

  const escapedQuery = query.replace(/[\\%_]/g, "\\$&")
  const { data, error } = await supabase
    .from("profiles")
    .select("id,handle,nickname,avatar_url")
    .not("handle", "is", null)
    .neq("id", user.id)
    .ilike("handle", `%${escapedQuery}%`)
    .order("handle")
    .limit(20)
  if (error) {
    console.error("friend profile search failed", { userId: user.id, code: error.code, message: error.message })
    return NextResponse.json({ error: "아이디를 검색하지 못했습니다." }, { status: 500 })
  }

  const profiles = (data || [])
    .sort((first, second) => {
      const firstStarts = first.handle?.startsWith(query) ? 0 : 1
      const secondStarts = second.handle?.startsWith(query) ? 0 : 1
      return firstStarts - secondStarts || (first.handle || "").localeCompare(second.handle || "")
    })
    .slice(0, 8)
  return NextResponse.json({ profiles })
}
