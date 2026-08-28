import { Crown } from "lucide-react"
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
    <div className={cn("flex max-w-md items-center gap-3.5 overflow-hidden rounded-2xl bg-primary/[0.075] px-4 py-3.5", className)}>
      <div className="flex shrink-0 -space-x-2">
        {visibleChampions.map((champion) => (
          <UserAvatar
            key={champion.userId}
            name={championName(champion)}
            imageUrl={champion.avatarUrl}
            className="size-11 border-2 border-background shadow-sm"
          />
        ))}
        {champions.length > 2 && (
          <span className="relative flex size-11 items-center justify-center rounded-full border-2 border-background bg-secondary text-[10px] font-semibold text-muted-foreground shadow-sm">
            +{champions.length - 2}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary"><Crown className="size-3" />오늘의 풀이왕</span>
        <p className="mt-1 truncate text-base font-semibold leading-tight tracking-tight">{nameLabel}</p>
      </div>
      <div className="shrink-0 rounded-xl bg-card/80 px-3 py-2 text-center shadow-sm">
        <p className="text-xl font-bold leading-none tabular-nums text-primary">{primaryChampion.solvedCount}</p>
        <p className="mt-1 text-[9px] font-semibold text-muted-foreground">문제</p>
      </div>
    </div>
  )
}
