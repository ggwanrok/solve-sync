export const DIFFICULTY_LEVELS = [0, 1, 2, 3, 4, 5] as const

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]
export type Difficulty = `Lv.${DifficultyLevel}`

export function difficultyLabel(value: unknown): Difficulty | null {
  if (value == null || (typeof value !== "number" && typeof value !== "string")) return null
  if (typeof value === "string" && value.trim() === "") return null
  const level = Number(value)
  if (!Number.isInteger(level) || level < 0 || level > 5) return null
  return `Lv.${level}` as Difficulty
}

export function minimumDifficultyLabel(value: DifficultyLevel) {
  return `${value}단계 이상`
}
