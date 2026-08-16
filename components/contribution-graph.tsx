"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ProblemDifficultyBadge } from "@/components/difficulty-badge"
import { APP_TIME_ZONE } from "@/lib/calendar"
import type { Difficulty } from "@/lib/difficulty"
import { cn } from "@/lib/utils"

const levelClass = ["bg-grass-0", "bg-grass-1", "bg-grass-2", "bg-grass-3", "bg-grass-4"]
const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"]

export type ContributionDay = {
  date: string
  problems: Array<{ title: string; language: string | null; difficulty: Difficulty | null }>
  isFuture?: boolean
}

function calendarDate(date: string) {
  return new Date(`${date}T12:00:00Z`)
}

function buildWeeks(data: ContributionDay[]) {
  if (!data.length) return []

  // The graph starts on Monday. Empty cells keep the first and last dates on
  // their real weekday instead of shifting every row as the date range moves.
  const firstWeekday = (calendarDate(data[0].date).getUTCDay() + 6) % 7
  const cells: Array<ContributionDay | null> = [
    ...Array.from<null>({ length: firstWeekday }).fill(null),
    ...data,
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: Array<Array<ContributionDay | null>> = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

function monthLabel(week: Array<ContributionDay | null>, weekIndex: number) {
  const days = week.filter((day): day is ContributionDay => day !== null)
  const labelDay = weekIndex === 0
    ? days[0]
    : days.find((day) => calendarDate(day.date).getUTCDate() === 1)

  return labelDay ? `${calendarDate(labelDay.date).getUTCMonth() + 1}월` : null
}

function displayDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function ContributionGraph({ data }: { data: ContributionDay[] }) {
  const weeks = buildWeeks(data)

  return (
    <TooltipProvider delay={100}>
      <div className="w-full overflow-x-auto">
        <div className="flex min-w-max flex-col gap-2">
          <div className="flex gap-[3px] text-xs text-muted-foreground">
            <span aria-hidden className="mr-1 w-5 shrink-0" />
            {weeks.map((week, weekIndex) => (
              <span key={weekIndex} className="w-[13px] shrink-0 whitespace-nowrap text-[10px]">
                {monthLabel(week, weekIndex)}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 grid w-5 shrink-0 grid-rows-7 gap-[3px] text-[9px] text-muted-foreground">
              {weekdayLabels.map((label, index) => (
                <span key={index} className="h-[13px] leading-[13px]">{label}</span>
              ))}
            </div>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((day, dayIndex) => {
                  if (!day) return <div key={`empty-${dayIndex}`} aria-hidden className="size-[13px]" />
                  if (day.isFuture) {
                    return (
                      <div
                        key={day.date}
                        data-date={day.date}
                        aria-hidden
                        className="size-[13px] rounded-[3px] bg-muted/35 ring-1 ring-inset ring-border/25"
                      />
                    )
                  }
                  const level = Math.min(day.problems.length, 4)
                  return <Tooltip key={day.date}>
                    <TooltipTrigger
                      render={
                        <div
                          data-date={day.date}
                          className={cn(
                            "size-[13px] rounded-[3px] ring-1 ring-inset ring-border/40 transition-colors",
                            levelClass[level],
                          )}
                        />
                      }
                    />
                    <TooltipContent side="top" className="max-w-72 text-xs">
                      <p className="font-medium">{displayDate(day.date)}</p>
                      {day.problems.length ? <ul className="mt-1.5 space-y-1">{day.problems.map((problem, index) => <li key={`${problem.title}-${index}`} className="flex items-center gap-2"><span className="max-w-40 truncate">{problem.title}</span><ProblemDifficultyBadge difficulty={problem.difficulty} className="text-[10px]" />{problem.language && <span className="text-muted-foreground">{problem.language}</span>}</li>)}</ul> : <p className="mt-1 text-muted-foreground">푼 문제 없음</p>}
                    </TooltipContent>
                  </Tooltip>
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 text-xs text-muted-foreground">
            <span>적음</span>
            {levelClass.map((c, i) => (
              <div key={i} className={cn("size-[13px] rounded-[3px] ring-1 ring-inset ring-border/40", c)} />
            ))}
            <span>많음</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
