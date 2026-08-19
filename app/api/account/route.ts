import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth-cookies"
import { normalizeNickname, normalizeProfileBio } from "@/lib/profile"
import { createRequestClient } from "@/utils/supabase/request"

async function viewer(request: Request) {
  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  return { supabase, user, error }
}

export async function PATCH(request: Request) {
  const { supabase, user } = await viewer(request)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: "올바른 요청이 필요합니다." }, { status: 400 })
  }

  const nickname = normalizeNickname(input.nickname)
  if (!nickname) {
    return NextResponse.json({ error: "표시 이름은 2~20자로 입력해 주세요." }, { status: 400 })
  }
  const bio = normalizeProfileBio(input.bio)
  if (bio === null) {
    return NextResponse.json({ error: "한 줄 소개는 40자 이내로 입력해 주세요." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ nickname, bio })
    .eq("id", user.id)
    .select("nickname,bio")
    .single()
  if (error) {
    console.error("profile update failed", { userId: user.id, code: error.code, message: error.message })
    return NextResponse.json({ error: "프로필을 변경하지 못했습니다." }, { status: 500 })
  }
  return NextResponse.json({ nickname: data.nickname, bio: data.bio })
}

export async function DELETE(request: Request) {
  const { supabase, user, error: userError } = await viewer(request)
  if (userError || !user) {
    const cookieStore = await cookies()
    console.error("account auth failed", { code: userError?.code, message: userError?.message, cookieNames: cookieStore.getAll().map(({ name }) => name) })
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const { data: avatarFiles, error: avatarListError } = await supabase.storage.from("avatars").list(user.id, { limit: 100 })
  if (avatarListError) {
    console.error("account avatar list failed", { userId: user.id, message: avatarListError.message })
  } else if (avatarFiles?.length) {
    const { error: avatarRemoveError } = await supabase.storage
      .from("avatars")
      .remove(avatarFiles.map((file) => `${user.id}/${file.name}`))
    if (avatarRemoveError) console.error("account avatar cleanup failed", { userId: user.id, message: avatarRemoveError.message })
  }

  const { error } = await supabase.rpc("delete_own_account")
  if (error) {
    console.error("delete_own_account failed", { code: error.code, details: error.details, hint: error.hint, message: error.message })
    return NextResponse.json({ error: "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) {
      response.cookies.delete(cookie.name)
    }
  }
  response.cookies.delete(ACCESS_TOKEN_COOKIE)
  response.cookies.delete(REFRESH_TOKEN_COOKIE)
  return response
}
