"use client"

import type { ReactNode } from "react"
import { BarChart3, Crown, Sprout, Trophy } from "lucide-react"
import { ContributionGraph, type ContributionDay } from "@/components/contribution-graph"
import { DifficultyBadge } from "@/components/difficulty-badge"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export type MemberProfile = {
  id: string
  name: string
  handle: string
  bio?: string | null
  avatarUrl: string | null
}

export type MemberRankingSummary = {
  rankingPosition: number | null
  rankingScore: number
  algorithmScore: number
  sqlScore: number
  algorithmSolved: number
  sqlSolved: number
  totalSolved: number
  levelSolved: [number, number, number, number, number, number]
  unknownSolved: number
}

type MemberProfileDialogProps = {
  profile: MemberProfile
  children: ReactNode
  triggerClassName: string
  badgeLabel?: string
  contributions?: ContributionDay[]
  ranking?: MemberRankingSummary
  onTriggerClick?: () => void
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value)
}

export function MemberProfileDialog({
  profile,
  children,
  triggerClassName,
  badgeLabel,
  contributions,
  ranking,
  onTriggerClick,
}: MemberProfileDialogProps) {
  const activeDays = contributions?.filter((day) => day.problems.length > 0).length || 0
  const solvedCount = contributions?.reduce((total, day) => total + day.problems.length, 0) || 0

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className={triggerClassName}
            onClick={onTriggerClick}
            aria-label={`${profile.name} 멤버 자세히 보기`}
          />
        }
      >
        {children}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{profile.name} 멤버 자세히 보기</DialogTitle>
          <DialogDescription>{profile.name}님의 프로필과 풀이 현황입니다.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center rounded-2xl bg-primary/[0.065] px-5 py-7 text-center sm:flex-row sm:text-left">
          <UserAvatar name={profile.name} imageUrl={profile.avatarUrl} className="size-24 ring-4 ring-background" />
          <div className="mt-4 min-w-0 sm:ml-5 sm:mt-0">
            <p className="truncate text-2xl font-bold tracking-tight">{profile.name}</p>
            <p className="mt-0.5 truncate text-sm text-primary">@{profile.handle}</p>
            {badgeLabel && <Badge variant="secondary" className="mt-3">{badgeLabel}</Badge>}
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {profile.bio || "아직 한 줄 소개가 없어요."}
            </p>
          </div>
        </div>

        {ranking && (
          <div className="rounded-2xl bg-muted/45 p-4">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                <Trophy className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium">랭킹 현황</p>
                <p className="text-xs text-muted-foreground">전체 풀이 기록을 바탕으로 한 점수</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-card p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Crown className="size-3.5" />전체 순위</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {ranking.rankingPosition ? `${formatNumber(ranking.rankingPosition)}위` : "집계 전"}
                </p>
              </div>
              <div className="rounded-xl bg-card p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BarChart3 className="size-3.5" />랭킹 점수</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{formatNumber(ranking.rankingScore)}점</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">알고리즘</p>
                  <p className="text-sm font-semibold tabular-nums">{formatNumber(ranking.algorithmScore)}점</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatNumber(ranking.algorithmSolved)}문제 해결</p>
              </div>
              <div className="rounded-xl bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">SQL</p>
                  <p className="text-sm font-semibold tabular-nums">{formatNumber(ranking.sqlScore)}점</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatNumber(ranking.sqlSolved)}문제 해결</p>
              </div>
            </div>

            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">단계별 풀이</p>
                <p className="text-xs text-muted-foreground">총 {formatNumber(ranking.totalSolved)}문제</p>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
                {ranking.levelSolved.map((count, level) => (
                  <div key={level} className="flex items-center justify-between gap-2">
                    <DifficultyBadge level={`Lv.${level}` as `Lv.${0 | 1 | 2 | 3 | 4 | 5}`} />
                    <p className="text-sm font-semibold tabular-nums">{formatNumber(count)}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">문제</span></p>
                  </div>
                ))}
              </div>
              {ranking.unknownSolved > 0 && (
                <p className="mt-3 text-right text-[11px] text-muted-foreground">난이도 미확인 {formatNumber(ranking.unknownSolved)}문제</p>
              )}
            </div>
          </div>
        )}

        {contributions && (
          <div className="rounded-2xl bg-muted/45 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <Sprout className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">잔디 현황</p>
                  <p className="text-xs text-muted-foreground">최근 16주 학습 강도</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                활동 <span className="font-medium text-foreground">{activeDays}일</span>
                <span aria-hidden="true"> · </span>
                풀이 <span className="font-medium text-foreground">{solvedCount}문제</span>
              </p>
            </div>
            <ContributionGraph data={contributions} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
