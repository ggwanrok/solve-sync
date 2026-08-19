import { NextResponse } from "next/server"
import { hasValidProfileImageSignature, isSupportedProfileImage, PROFILE_IMAGE_MAX_BYTES } from "@/lib/profile"
import { createRequestClient } from "@/utils/supabase/request"

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > PROFILE_IMAGE_MAX_BYTES + 256 * 1024) {
    return NextResponse.json({ error: "압축된 프로필 사진은 500KB 이하여야 합니다." }, { status: 413 })
  }

  const { supabase, accessToken } = await createRequestClient(request)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "올바른 이미지 파일이 필요합니다." }, { status: 400 })
  }

  const avatar = formData.get("avatar")
  if (!(avatar instanceof File) || !isSupportedProfileImage(avatar)) {
    return NextResponse.json({ error: "JPG, PNG, WebP 형식의 500KB 이하 이미지가 필요합니다." }, { status: 400 })
  }

  const signature = new Uint8Array(await avatar.slice(0, 12).arrayBuffer())
  if (!hasValidProfileImageSignature(signature, avatar.type)) {
    return NextResponse.json({ error: "이미지 파일의 형식을 확인해 주세요." }, { status: 400 })
  }

  const extension = extensionByType[avatar.type]
  const fileName = `avatar-${crypto.randomUUID()}.${extension}`
  const storagePath = `${user.id}/${fileName}`
  const bucket = supabase.storage.from("avatars")
  const { error: uploadError } = await bucket.upload(storagePath, avatar, {
    contentType: avatar.type,
    cacheControl: "31536000",
    upsert: false,
  })
  if (uploadError) {
    console.error("profile avatar upload failed", { userId: user.id, message: uploadError.message })
    return NextResponse.json({ error: "프로필 사진을 업로드하지 못했습니다." }, { status: 500 })
  }

  const { data: publicUrlData } = bucket.getPublicUrl(storagePath)
  const avatarUrl = publicUrlData.publicUrl
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)
  if (profileError) {
    await bucket.remove([storagePath])
    console.error("profile avatar url update failed", { userId: user.id, code: profileError.code, message: profileError.message })
    return NextResponse.json({ error: "프로필 사진을 적용하지 못했습니다." }, { status: 500 })
  }

  const { data: avatarFiles, error: listError } = await bucket.list(user.id, { limit: 100 })
  if (listError) {
    console.error("previous profile avatars list failed", { userId: user.id, message: listError.message })
  } else {
    const stalePaths = (avatarFiles || [])
      .filter((file) => file.name !== fileName)
      .map((file) => `${user.id}/${file.name}`)
    if (stalePaths.length) {
      const { error: cleanupError } = await bucket.remove(stalePaths)
      if (cleanupError) console.error("previous profile avatars cleanup failed", { userId: user.id, message: cleanupError.message })
    }
  }

  return NextResponse.json({ avatarUrl })
}
