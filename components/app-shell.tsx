"use client"

import { LayoutDashboard, Users, BookOpen, BookOpenCheck, Chrome, Menu, RefreshCw, LoaderCircle } from "lucide-react"
import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Logo } from "@/components/logo"
import { ContributionGraph, type ContributionDay } from "@/components/contribution-graph"
import { MemberProfileDialog } from "@/components/member-profile-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountDialog, type AccountUser } from "@/components/account-dialog"
import { ExtensionBrowserHeader, ExtensionConnectionProvider } from "@/components/extension-browser-connection"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { NotificationCenter } from "@/components/notification-center"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useActionTransition } from "@/lib/use-pending-action"
import { cn } from "@/lib/utils"
import type { StudyNotificationInbox } from "@/lib/study-notification"

export type ShellUser = AccountUser & { pendingFriendRequestCount: number }

const nav = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/friends", label: "친구", icon: Users },
  { href: "/study", label: "스터디룸", icon: BookOpen },
  { href: "/notes", label: "문제", icon: BookOpenCheck },
]

function NavigationProgress() {
  const { pending } = useLinkStatus()
  return pending ? <LoaderCircle className="ml-auto size-4 animate-spin" role="status" aria-label="페이지 이동 중" /> : null
}

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
            aria-current={active ? "page" : undefined}
            prefetch
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow,transform] active:scale-[0.99]",
              active
                ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
            {item.label}
            <NavigationProgress />
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
          className="flex h-10 items-center justify-center gap-2 rounded-lg border border-sidebar-border/80 bg-card px-3 text-xs font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Chrome className="size-3.5 text-primary" aria-hidden="true" />
          프로그래머스 연동방법
        </Link>
        <div className="rounded-xl border border-sidebar-border/80 bg-card px-3 py-4">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="font-medium text-sidebar-foreground">나의 잔디</span>
            <span>최근 16주</span>
          </div>
          <ContributionGraph data={contributions} compact />
        </div>
        <MemberProfileDialog
          profile={{ id: user.id, name: user.name, handle: user.handle, bio: user.bio, avatarUrl: user.avatarUrl }}
          badgeLabel="나"
          contributions={contributions}
          triggerClassName="flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-sidebar-accent/65 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar name={user.name} imageUrl={user.avatarUrl} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
          </div>
        </MemberProfileDialog>
      </div>
    </div>
  )
}

export function AppShell({ children, user, contributions, notificationInbox }: { children: React.ReactNode; user: ShellUser; contributions: ContributionDay[]; notificationInbox: StudyNotificationInbox }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refreshPending, runRefresh] = useActionTransition()
  const router = useRouter()
  const pathname = usePathname()
  const refreshLabel = pathname === "/"
    ? "대시보드"
    : pathname === "/friends"
      ? "친구"
      : pathname.startsWith("/study")
        ? "스터디룸"
        : pathname.startsWith("/notes")
          ? "문제"
        : pathname === "/programmers"
          ? "연동 안내"
        : null

  function refreshCurrentPage() {
    runRefresh(() => router.refresh())
  }

  return (
    <ExtensionConnectionProvider accountId={user.id} devices={user.extensionDevices}>
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border/70 bg-sidebar lg:block">
        <SidebarContent user={user} contributions={contributions} />
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="inset-y-0 left-0 top-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-r border-sidebar-border/70 bg-sidebar p-0 sm:max-w-72 sm:p-0 data-open:zoom-in-100 data-closed:zoom-out-100 data-open:slide-in-from-left-4 data-closed:slide-out-to-left-4">
          <DialogTitle className="sr-only">메뉴</DialogTitle>
          <DialogDescription className="sr-only">대시보드, 친구, 스터디룸과 문제로 이동합니다.</DialogDescription>
          <SidebarContent user={user} contributions={contributions} onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/55 bg-background/88 px-4 backdrop-blur-xl md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="메뉴 열기" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>

          <div className="flex items-center gap-2 lg:hidden">
            <Logo showText={false} />
          </div>

          {refreshLabel && (
            <p className="hidden text-sm font-semibold tracking-[-0.015em] lg:block">
              {refreshLabel}
            </p>
          )}

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
            <ExtensionBrowserHeader className="hidden md:flex" />
            <NotificationCenter inbox={notificationInbox} />
            <ThemeToggle />
            <AccountDialog user={user} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div key={pathname} className="app-page-enter">{children}</div>
        </main>
        <footer className="px-4 pb-6 text-center text-xs text-muted-foreground md:px-6 lg:px-8">
          <Link href="/about" className="underline-offset-4 hover:text-foreground hover:underline">
            서비스 소개 · 개인정보 처리방침
          </Link>
        </footer>
      </div>
    </div>
    </ExtensionConnectionProvider>
  )
}
