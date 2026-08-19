import { CheckCircle2, Flame, Target, UserPlus } from "lucide-react"
import { DifficultyBadge } from "@/components/difficulty-badge"
import { UserAvatar } from "@/components/user-avatar"
import type { ActivityItem } from "@/lib/mock-data"

const iconMap = {
  solve: { icon: CheckCircle2, className: "text-primary" },
  streak: { icon: Flame, className: "text-warning-foreground" },
  join: { icon: UserPlus, className: "text-chart-4" },
  goal: { icon: Target, className: "text-primary" },
}

export function ActivityFeedList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => {
        const { icon: Icon, className } = iconMap[item.type]
        return (
          <li key={item.id} className="flex gap-3 py-3">
            <div className="relative flex flex-col items-center">
              <UserAvatar name={item.name} imageUrl={item.avatar} className="size-9" />
              {i < items.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="flex-1 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-relaxed">
                  <span className="font-medium">{item.name}</span>
                  {item.type === "solve" ? (
                    <>
                      님이 <span className="font-medium">{item.problem}</span> 문제를 해결했어요{" "}
                      {item.difficulty && <DifficultyBadge level={item.difficulty} />}
                    </>
                  ) : (
                    <span className="text-muted-foreground"> · {item.detail}</span>
                  )}
                </p>
                <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.time}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
