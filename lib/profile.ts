export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 20

export function normalizeNickname(input: unknown) {
  if (typeof input !== "string") return null

  const nickname = input.trim().replace(/\s+/g, " ")
  const length = Array.from(nickname).length
  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) return null
  if (/[\u0000-\u001f\u007f]/u.test(nickname)) return null
  return nickname
}

export function isSupportedProfileImage(file: { size: number; type: string }) {
  return file.size > 0
    && file.size <= PROFILE_IMAGE_MAX_BYTES
    && PROFILE_IMAGE_TYPES.includes(file.type as (typeof PROFILE_IMAGE_TYPES)[number])
}

export function hasValidProfileImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value)
  }
  if (type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  }
  return false
}
