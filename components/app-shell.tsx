"use client"

import { Popover } from "@base-ui/react/popover"
import { LoaderCircle, RefreshCw, UserRound } from "lucide-react"
import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Logo } from "@/components/logo"
import { ContributionGraph, type ContributionDay } from "@/components/contribution-graph"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountDialog, type AccountUser } from "@/components/account-dialog"
import { ExtensionConnectionMenu, ExtensionConnectionProvider } from "@/components/extension-browser-connection"
import { NotificationCenter } from "@/components/notification-center"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StudyNotificationInbox } from "@/lib/study-notification"

export type ShellUser = AccountUser & { pendingFriendRequestCount: number }

const nav = [
  { href: "/", label: "대시보드" },
  { href: "/friends", label: "친구" },
  { href: "/study", label: "스터디룸" },
  { href: "/notes", label: "문제" },
]

function NavigationProgress() {
  const { pending } = useLinkStatus()
  return pending ? <LoaderCircle className="size-3.5 animate-spin" role="status" aria-label="페이지 이동 중" /> : null
}

function NavLinks({ pendingFriendRequestCount }: { pendingFriendRequestCount: number }) {
  const pathname = usePathname()
  return (
    <nav aria-label="주 메뉴" className="flex h-12 items-stretch justify-between gap-0.5 whitespace-nowrap lg:h-full lg:justify-start lg:gap-1">
      {nav.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            prefetch
            className={cn(
              "flex h-full items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors sm:px-3",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:bg-muted/65 hover:text-foreground",
            )}
          >
            <span className={cn(active && "underline decoration-primary decoration-2 underline-offset-[7px]")}>{item.label}</span>
            <NavigationProgress />
            {item.href === "/friends" && pendingFriendRequestCount > 0 && (
              <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]" aria-label={`받은 친구 요청 ${pendingFriendRequestCount}건`}>
                {pendingFriendRequestCount > 99 ? "99+" : pendingFriendRequestCount}
              </Badge>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function ProfileMenu({ user, contributions, refreshLabel, refreshPending, onRefresh }: {
  user: ShellUser
  contributions: ContributionDay[]
  refreshLabel: string | null
  refreshPending: boolean
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="shrink-0 rounded-full outline-none ring-ring focus-visible:ring-2" aria-label="프로필 메뉴 열기">
          <UserAvatar name={user.name} imageUrl={user.avatarUrl} className="size-9 sm:size-10" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={8} className="z-50">
            <Popover.Popup className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-popover p-3 text-popover-foreground shadow-[0_16px_48px_rgba(15,23,42,0.16)] ring-1 ring-foreground/[0.065] outline-none">
              <Popover.Title className="sr-only">내 계정</Popover.Title>
              <div className="flex items-center gap-3 px-1 py-1">
                <UserAvatar name={user.name} imageUrl={user.avatarUrl} className="size-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
                </div>
              </div>
              <div className="my-3 border-y border-border py-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium">나의 잔디</span>
                  <span className="text-muted-foreground">최근 16주</span>
                </div>
                <ContributionGraph data={contributions} compact />
              </div>
              <button
                type="button"
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => { setOpen(false); setAccountOpen(true) }}
              >
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                마이페이지
              </button>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 sm:hidden">
                {refreshLabel && (
                  <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={refreshPending} aria-label={`${refreshLabel} 새로고침`}>
                    <RefreshCw className={refreshPending ? "animate-spin" : undefined} />
                    새로고침
                  </Button>
                )}
                <ThemeToggle />
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <AccountDialog user={user} open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  )
}

export function AppShell({ children, user, contributions, notificationInbox }: { children: React.ReactNode; user: ShellUser; contributions: ContributionDay[]; notificationInbox: StudyNotificationInbox }) {
  const [refreshPending, setRefreshPending] = useState(false)
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
    setRefreshPending(true)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.location.reload())
    })
  }

  return (
    <ExtensionConnectionProvider accountId={user.id} devices={user.extensionDevices}>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-border/55 bg-card">
          <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-4 md:px-6 lg:px-8">
            <Link href="/" aria-label="솔브싱크 대시보드" className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Logo showText={false} className="sm:hidden" />
              <Logo className="hidden sm:flex" />
            </Link>
            <div className="hidden h-full lg:block">
              <NavLinks pendingFriendRequestCount={user.pendingFriendRequestCount} />
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
              <div className="flex items-end gap-1 sm:gap-2">
                <ExtensionConnectionMenu />
                {refreshLabel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden gap-1.5 sm:inline-flex"
                    onClick={refreshCurrentPage}
                    disabled={refreshPending}
                    aria-busy={refreshPending}
                    aria-label={`${refreshLabel} 새로고침`}
                  >
                    <RefreshCw className={refreshPending ? "animate-spin" : undefined} />
                    새로고침
                  </Button>
                )}
              </div>
              <NotificationCenter inbox={notificationInbox} />
              <div className="hidden sm:block"><ThemeToggle /></div>
              <ProfileMenu user={user} contributions={contributions} refreshLabel={refreshLabel} refreshPending={refreshPending} onRefresh={refreshCurrentPage} />
            </div>
          </div>
          <div className="border-t border-border/35 px-2 sm:px-4 lg:hidden">
            <NavLinks pendingFriendRequestCount={user.pendingFriendRequestCount} />
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
    </ExtensionConnectionProvider>
  )
}
