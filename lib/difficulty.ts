export const DIFFICULTY_LEVELS = [0, 1, 2, 3, 4, 5] as const
export const MAX_CONTRIBUTION_INTENSITY = 6

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]
export type Difficulty = `Lv.${DifficultyLevel}`

export function difficultyLevel(value: unknown): DifficultyLevel | null {
  if (value == null || (typeof value !== "number" && typeof value !== "string")) return null
  if (typeof value === "string" && value.trim() === "") return null
  const normalized = typeof value === "string" ? value.trim().replace(/^Lv\./, "") : value
  const level = Number(normalized)
  if (!Number.isInteger(level) || level < 0 || level > 5) return null
  return level as DifficultyLevel
}

export function difficultyLabel(value: unknown): Difficulty | null {
  const level = difficultyLevel(value)
  if (level == null) return null
  return `Lv.${level}` as Difficulty
}

export function contributionIntensity(difficulties: readonly unknown[]) {
  const score = difficulties.reduce((total: number, difficulty) => {
    const level = difficultyLevel(difficulty)

    // Lv.0 and records without difficulty metadata still count as activity.
    return total + (level == null ? 1 : level + 1)
  }, 0)

  return Math.min(score, MAX_CONTRIBUTION_INTENSITY)
}

export function minimumDifficultyLabel(value: DifficultyLevel) {
  return `${value}단계 이상`
}
