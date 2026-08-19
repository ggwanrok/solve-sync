import { difficultyLabel, type Difficulty } from "@/lib/difficulty"
import { cn } from "@/lib/utils"

const styles: Record<Difficulty, string> = {
  "Lv.0": "bg-difficulty-0/12 text-slate-600 ring-difficulty-0/25 dark:text-slate-300",
  "Lv.1": "bg-difficulty-1/15 text-blue-700 ring-difficulty-1/30 dark:text-blue-300",
  "Lv.2": "bg-difficulty-2/15 text-emerald-700 ring-difficulty-2/30 dark:text-emerald-300",
  "Lv.3": "bg-difficulty-3/18 text-yellow-700 ring-difficulty-3/35 dark:text-yellow-300",
  "Lv.4": "bg-difficulty-4/15 text-orange-700 ring-difficulty-4/30 dark:text-orange-300",
  "Lv.5": "bg-difficulty-5/15 text-red-700 ring-difficulty-5/30 dark:text-red-300",
}

export function DifficultyBadge({ level, className }: { level: Difficulty; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-medium ring-1 ring-inset",
        styles[level],
        className,
      )}
    >
      {level}
    </span>
  )
}

export function ProblemDifficultyBadge({ difficulty, className }: { difficulty: unknown; className?: string }) {
  const level = difficultyLabel(difficulty)
  if (level) return <DifficultyBadge level={level} className={className} />

  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border", className)}>
      난이도 미확인
    </span>
  )
}
