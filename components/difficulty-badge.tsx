import { difficultyLabel, type Difficulty } from "@/lib/difficulty"
import { cn } from "@/lib/utils"

const styles: Record<Difficulty, string> = {
  "Lv.0": "bg-muted text-muted-foreground ring-border",
  "Lv.1": "bg-chart-2/15 text-chart-2 ring-chart-2/25",
  "Lv.2": "bg-primary/12 text-primary ring-primary/25",
  "Lv.3": "bg-chart-3/15 text-warning-foreground ring-chart-3/30",
  "Lv.4": "bg-chart-4/15 text-chart-4 ring-chart-4/25",
  "Lv.5": "bg-destructive/12 text-destructive ring-destructive/25",
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
