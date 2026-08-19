import assert from "node:assert/strict"
import test from "node:test"
import {
  hasValidProfileImageSignature,
  isSupportedProfileImage,
  normalizeNickname,
  profileImageUrl,
  PROFILE_IMAGE_INPUT_MAX_BYTES,
  PROFILE_IMAGE_MAX_BYTES,
} from "../lib/profile.ts"

test("표시 이름의 앞뒤와 연속 공백을 정리한다", () => {
  assert.equal(normalizeNickname("  김   도현  "), "김 도현")
})

test("표시 이름은 2자 이상 20자 이하만 허용한다", () => {
  assert.equal(normalizeNickname("김"), null)
  assert.equal(normalizeNickname("가".repeat(21)), null)
  assert.equal(normalizeNickname("김도현"), "김도현")
})

test("압축된 프로필 사진은 지원 형식과 500KB 제한을 확인한다", () => {
  assert.equal(isSupportedProfileImage({ type: "image/png", size: PROFILE_IMAGE_MAX_BYTES }), true)
  assert.equal(isSupportedProfileImage({ type: "image/gif", size: 100 }), false)
  assert.equal(isSupportedProfileImage({ type: "image/jpeg", size: PROFILE_IMAGE_MAX_BYTES + 1 }), false)
})

test("압축 전 원본 프로필 사진은 최대 5MB까지 허용한다", () => {
  assert.equal(isSupportedProfileImage({ type: "image/jpeg", size: PROFILE_IMAGE_INPUT_MAX_BYTES }, PROFILE_IMAGE_INPUT_MAX_BYTES), true)
  assert.equal(isSupportedProfileImage({ type: "image/jpeg", size: PROFILE_IMAGE_INPUT_MAX_BYTES + 1 }, PROFILE_IMAGE_INPUT_MAX_BYTES), false)
})

test("프로필 사진의 실제 파일 헤더를 확인한다", () => {
  assert.equal(hasValidProfileImageSignature(Uint8Array.from([0xff, 0xd8, 0xff]), "image/jpeg"), true)
  assert.equal(hasValidProfileImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true)
  assert.equal(hasValidProfileImageSignature(new TextEncoder().encode("RIFF1234WEBP"), "image/webp"), true)
  assert.equal(hasValidProfileImageSignature(new TextEncoder().encode("not an image"), "image/png"), false)
})

test("앱에서 업로드하지 않은 프로필 URL은 기본 이미지로 표시한다", () => {
  const uploaded = "https://project.supabase.co/storage/v1/object/public/avatars/user/avatar.png"
  assert.equal(profileImageUrl(uploaded), uploaded)
  assert.equal(profileImageUrl("https://lh3.googleusercontent.com/profile.jpg"), "/placeholder-user.jpg")
  assert.equal(profileImageUrl(null), "/placeholder-user.jpg")
})
