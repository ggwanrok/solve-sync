"use client"

import { LayoutDashboard, Users, BookOpen, Chrome, Menu, NotebookPen, RefreshCw } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Logo } from "@/components/logo"
import { ContributionGraph, type ContributionDay } from "@/components/contribution-graph"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountDialog, type AccountUser } from "@/components/account-dialog"
import { ExtensionBrowserBadge, useExtensionBrowserStatus } from "@/components/extension-browser-connection"
import { NotificationCenter } from "@/components/notification-center"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StudyNotificationInbox } from "@/lib/study-notification"

export type ShellUser = AccountUser & { pendingFriendRequestCount: number }

const nav = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/friends", label: "친구", icon: Users },
  { href: "/study", label: "스터디룸", icon: BookOpen },
  { href: "/notes", label: "문제 메모", icon: NotebookPen },
]

function NavLinks({ pendingFriendRequestCount, onNavigate }: { pendingFriendRequestCount: number; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1.5">
      {nav.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-[background-color,color,transform] active:scale-[0.99]",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
            {item.label}
            {item.href === "/friends" && pendingFriendRequestCount > 0 && (
              <Badge className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]" aria-label={`받은 친구 요청 ${pendingFriendRequestCount}건`}>
                {pendingFriendRequestCount > 99 ? "99+" : pendingFriendRequestCount}
              </Badge>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarContent({ user, contributions, onNavigate }: { user: ShellUser; contributions: ContributionDay[]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-8 px-4 py-5">
      <div className="px-2 py-1">
        <Link href="/" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <NavLinks pendingFriendRequestCount={user.pendingFriendRequestCount} onNavigate={onNavigate} />

      <div className="mt-auto flex flex-col gap-4">
        <Link
          href="/programmers"
          onClick={onNavigate}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-card px-3 text-xs font-semibold text-sidebar-foreground shadow-sm ring-1 ring-foreground/[0.065] transition-colors hover:bg-sidebar-accent"
        >
          <Chrome className="size-3.5 text-primary" aria-hidden="true" />
          프로그래머스 연동방법
        </Link>
        <div className="rounded-2xl bg-card px-3 py-4 shadow-sm ring-1 ring-foreground/[0.055]">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-sidebar-foreground">나의 잔디</span>
            <span>최근 16주</span>
          </div>
          <ContributionGraph data={contributions} compact />
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-1">
          <UserAvatar name={user.name} imageUrl={user.avatarUrl} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children, user, contributions, notificationInbox }: { children: React.ReactNode; user: ShellUser; contributions: ContributionDay[]; notificationInbox: StudyNotificationInbox }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refreshPending, setRefreshPending] = useState(false)
  const pathname = usePathname()
  const extensionConnectionVersion = (user.extensionDevices || []).map((device) => device.installationId).join(",")
  const browserExtensionStatus = useExtensionBrowserStatus(user.id, extensionConnectionVersion)
  const refreshLabel = pathname === "/"
    ? "대시보드"
    : pathname === "/friends"
      ? "친구"
      : pathname.startsWith("/study")
        ? "스터디룸"
        : pathname.startsWith("/notes")
          ? "문제 메모"
        : pathname === "/programmers"
          ? "연동 안내"
        : null

  function refreshCurrentPage() {
    setRefreshPending(true)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.location.reload())
    })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border/70 bg-sidebar lg:block">
        <SidebarContent user={user} contributions={contributions} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-sidebar-border/70 bg-sidebar shadow-2xl">
            <SidebarContent user={user} contributions={contributions} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/55 bg-background/88 px-4 backdrop-blur-xl md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>

          <div className="flex items-center gap-2 lg:hidden">
            <Logo showText={false} />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {refreshLabel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={refreshCurrentPage}
                disabled={refreshPending}
                aria-busy={refreshPending}
                aria-label={`${refreshLabel} 새로고침`}
              >
                <RefreshCw className={refreshPending ? "animate-spin" : undefined} />
                <span className="hidden sm:inline">새로고침</span>
              </Button>
            )}
            <ExtensionBrowserBadge status={browserExtensionStatus} className="hidden md:flex" />
            <NotificationCenter key={`${notificationInbox.unreadCount}:${notificationInbox.items[0]?.id || "empty"}:${notificationInbox.items[0]?.readAt || "unread"}`} inbox={notificationInbox} />
            <ThemeToggle />
            <AccountDialog user={user} browserExtensionStatus={browserExtensionStatus} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
        <footer className="px-4 pb-6 text-center text-xs text-muted-foreground md:px-6 lg:px-8">
          <Link href="/about" className="underline-offset-4 hover:text-foreground hover:underline">
            서비스 소개 · 개인정보 처리방침
          </Link>
        </footer>
      </div>
    </div>
  )
}
