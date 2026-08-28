import { Crown, Sparkles } from "lucide-react"
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

  return (
    <div className={cn("relative isolate flex max-w-sm items-center gap-3 overflow-hidden rounded-xl border border-amber-400/35 bg-gradient-to-r from-amber-500/[0.08] via-card to-primary/[0.08] px-3.5 py-2.5 shadow-sm", className)}>
      <div className="pointer-events-none absolute -right-3 -top-5 size-20 rounded-full bg-amber-400/10 blur-xl" />
      <div className="relative shrink-0">
        <UserAvatar name={championName(primaryChampion)} imageUrl={primaryChampion.avatarUrl} className="size-9 ring-2 ring-amber-400/40 ring-offset-2 ring-offset-card" />
        <span className="absolute -right-1.5 -top-2 flex size-5 rotate-12 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm">
          <Crown className="size-3" fill="currentColor" aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
          <Sparkles className="size-3 animate-pulse" aria-hidden="true" />오늘의 풀이왕
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold">{nameLabel}</p>
        <p className="text-[11px] text-muted-foreground">오늘 {primaryChampion.solvedCount}문제 해결</p>
      </div>
    </div>
  )
}
