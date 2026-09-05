const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type StudyRoomSettingsInput = {
  studyId: string
  name: string
  description: string
  isPrivate: boolean
  password: string | null
}

export function normalizeStudyRoomSettings(input: unknown): StudyRoomSettingsInput | null {
  if (!input || typeof input !== "object") return null
  const value = input as Record<string, unknown>
  if (typeof value.studyId !== "string" || !UUID_PATTERN.test(value.studyId)) return null
  if (typeof value.name !== "string" || typeof value.description !== "string" || typeof value.isPrivate !== "boolean") return null
  if (value.password !== null && typeof value.password !== "string") return null

  const name = value.name.trim()
  const description = value.description.trim()
  if (Array.from(name).length < 1 || Array.from(name).length > 30) return null
  if (Array.from(description).length > 100) return null
  if (typeof value.password === "string" && value.password.length > 50) return null

  return {
    studyId: value.studyId.toLowerCase(),
    name,
    description,
    isPrivate: value.isPrivate,
    password: value.isPrivate && value.password ? value.password : null,
  }
}
