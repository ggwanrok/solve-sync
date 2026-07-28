import type { Difficulty } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const styles: Record<Difficulty, string> = {
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
