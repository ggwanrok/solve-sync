import assert from "node:assert/strict"
import test from "node:test"
import {
  hasValidProfileImageSignature,
  isSupportedProfileImage,
  normalizeNickname,
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

test("프로필 사진은 지원 형식과 2MB 제한을 확인한다", () => {
  assert.equal(isSupportedProfileImage({ type: "image/png", size: PROFILE_IMAGE_MAX_BYTES }), true)
  assert.equal(isSupportedProfileImage({ type: "image/gif", size: 100 }), false)
  assert.equal(isSupportedProfileImage({ type: "image/jpeg", size: PROFILE_IMAGE_MAX_BYTES + 1 }), false)
})

test("프로필 사진의 실제 파일 헤더를 확인한다", () => {
  assert.equal(hasValidProfileImageSignature(Uint8Array.from([0xff, 0xd8, 0xff]), "image/jpeg"), true)
  assert.equal(hasValidProfileImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true)
  assert.equal(hasValidProfileImageSignature(new TextEncoder().encode("RIFF1234WEBP"), "image/webp"), true)
  assert.equal(hasValidProfileImageSignature(new TextEncoder().encode("not an image"), "image/png"), false)
})
