export const PROFILE_IMAGE_INPUT_MAX_BYTES = 5 * 1024 * 1024
export const PROFILE_IMAGE_MAX_BYTES = 500 * 1024
export const PROFILE_IMAGE_DIMENSION = 512
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 20
export const PROFILE_BIO_MAX_LENGTH = 40
export const DEFAULT_PROFILE_IMAGE = "/placeholder-user.jpg"

export function normalizeNickname(input: unknown) {
  if (typeof input !== "string") return null

  const nickname = input.trim().replace(/\s+/g, " ")
  const length = Array.from(nickname).length
  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) return null
  if (/[\u0000-\u001f\u007f]/u.test(nickname)) return null
  return nickname
}

export function normalizeProfileBio(input: unknown) {
  if (typeof input !== "string") return null
  if (/[\u0000-\u001f\u007f]/u.test(input)) return null

  const bio = input.trim().replace(/\s+/g, " ")
  if (Array.from(bio).length > PROFILE_BIO_MAX_LENGTH) return null
  return bio
}

export function isSupportedProfileImage(file: { size: number; type: string }, maxBytes = PROFILE_IMAGE_MAX_BYTES) {
  return file.size > 0
    && file.size <= maxBytes
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

export function profileImageUrl(imageUrl: string | null | undefined) {
  return imageUrl?.includes("/storage/v1/object/public/avatars/")
    ? imageUrl
    : DEFAULT_PROFILE_IMAGE
}
