"use client"

import { Bell, BellRing, Check, CircleAlert, Crown, Hand, LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authenticatedFetch } from "@/lib/authenticated-fetch"
import type { StudyNotification, StudyNotificationInbox, StudyNotificationType } from "@/lib/study-notification"
import { cn } from "@/lib/utils"

const notificationIcon: Record<StudyNotificationType, typeof Bell> = {
  goal_reminder: BellRing,
  goal_missed: CircleAlert,
  weekly_summary: Crown,
  poke: Hand,
}

function relativeDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(elapsed / 60_000))
  if (minutes < 1) return "방금"
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
}

async function markRead(id?: string) {
  const response = await authenticatedFetch("/api/notifications", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(id ? { id } : {}),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(result?.error || "알림을 읽음 처리하지 못했습니다.")
  }
}

export function NotificationCenter({ inbox }: { inbox: StudyNotificationInbox }) {
  const router = useRouter()
  const [items, setItems] = useState(inbox.items)
  const [unreadCount, setUnreadCount] = useState(inbox.unreadCount)
  const [markingAll, setMarkingAll] = useState(false)

  function readItemOptimistically(id: string) {
    setItems((current) => current.map((item) => item.id === id && !item.readAt
      ? { ...item, readAt: new Date().toISOString() }
      : item))
    setUnreadCount((current) => {
      const wasUnread = items.some((item) => item.id === id && !item.readAt)
      return wasUnread ? Math.max(0, current - 1) : current
    })
  }

  async function openNotification(item: StudyNotification) {
    if (!item.readAt) {
      readItemOptimistically(item.id)
      try {
        await markRead(item.id)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "알림을 읽음 처리하지 못했습니다.")
      }
    }
    router.push(item.url)
  }

  async function markAllRead() {
    setMarkingAll(true)
    try {
      await markRead()
      const readAt = new Date().toISOString()
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })))
      setUnreadCount(0)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "알림을 읽음 처리하지 못했습니다.")
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}개, 알림함 열기` : "알림함 열기"}
          />
        }
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-4.5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-[min(calc(100vw-2rem),25rem)] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold">알림</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : "새로운 알림이 없어요"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={markAllRead} disabled={markingAll} className="gap-1 text-muted-foreground">
              {markingAll ? <LoaderCircle className="animate-spin" /> : <Check />}
              모두 읽음
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Bell className="size-5" /></span>
            <p className="mt-3 text-sm font-medium">아직 쌓인 알림이 없어요</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">스터디 목표와 멤버 소식을 여기에 모아드릴게요.</p>
          </div>
        ) : (
          <div className="max-h-[min(32rem,calc(100vh-8rem))] overflow-y-auto p-2">
            {items.map((item) => {
              const Icon = notificationIcon[item.type] || Bell
              return (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => void openNotification(item)}
                  className={cn(
                    "items-start gap-3 rounded-xl px-3.5 py-3.5",
                    !item.readAt && "bg-primary/[0.07] focus:bg-primary/[0.11]",
                  )}
                >
                  <span className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    item.type === "goal_missed" ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary",
                  )}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold">{item.title}</span>
                      {!item.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="읽지 않음" />}
                      <time dateTime={item.createdAt} suppressHydrationWarning className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground">{relativeDate(item.createdAt)}</time>
                    </span>
                    <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">{item.body}</span>
                  </span>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
