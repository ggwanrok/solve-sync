import { UserAvatar } from "@/components/user-avatar"
import type { StudyDailyChampion } from "@/lib/study-room-data"
import { cn } from "@/lib/utils"

function championName(champion: StudyDailyChampion) {
  return champion.nickname?.trim() || champion.handle || "스터디원"
}

export function StudyDailyChampionBanner({ champions, className }: { champions: StudyDailyChampion[]; className?: string }) {
  if (!champions.length) return null

  const primaryChampion = champions[0]
  const names = champions.map(championName)
  const nameLabel = names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}명`
  const visibleChampions = champions.slice(0, 2)

  return (
    <div className={cn("flex max-w-sm items-center gap-3 rounded-xl border border-border/70 bg-muted/35 px-3 py-2", className)}>
      <span className="h-7 w-0.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
      <div className="flex shrink-0 -space-x-2">
        {visibleChampions.map((champion) => (
          <UserAvatar
            key={champion.userId}
            name={championName(champion)}
            imageUrl={champion.avatarUrl}
            className="size-8 border-2 border-card"
          />
        ))}
        {champions.length > 2 && (
          <span className="relative flex size-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-semibold text-muted-foreground">
            +{champions.length - 2}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold tracking-[0.14em] text-muted-foreground">TODAY&apos;S TOP SOLVER</p>
        <p className="mt-0.5 truncate text-sm font-semibold leading-none">{nameLabel}</p>
      </div>
      <div className="ml-auto shrink-0 rounded-lg bg-background px-2 py-1 text-sm font-semibold tabular-nums text-primary ring-1 ring-border/70">
        {primaryChampion.solvedCount}<span className="ml-0.5 text-[10px] font-medium text-muted-foreground">문제</span>
      </div>
    </div>
  )
}
