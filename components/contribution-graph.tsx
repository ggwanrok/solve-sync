"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const levelClass = ["bg-grass-0", "bg-grass-1", "bg-grass-2", "bg-grass-3", "bg-grass-4"]
const months = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]

export type ContributionDay = { date: string; problems: Array<{ title: string; language: string | null }> }

export function ContributionGraph({ data }: { data: ContributionDay[] }) {
  // data length = 52*7, chunk into weeks (columns)
  const weeks: ContributionDay[][] = []
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7))
  }

  return (
    <TooltipProvider delay={100}>
      <div className="w-full overflow-x-auto">
        <div className="flex min-w-max flex-col gap-2">
          <div className="flex gap-[3px] pl-7 text-xs text-muted-foreground">
            {weeks.map((_, wi) =>
              wi % 4 === 0 ? (
                <span key={wi} className="w-[13px] shrink-0 text-[10px]">
                  {months[Math.floor((wi / 52) * 12) % 12]}
                </span>
              ) : (
                <span key={wi} className="w-[13px] shrink-0" />
              ),
            )}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 flex flex-col justify-between gap-[3px] py-[2px] text-[10px] text-muted-foreground">
              <span>월</span>
              <span>수</span>
              <span>금</span>
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  const level = Math.min(day.problems.length, 4)
                  return <Tooltip key={day.date}>
                    <TooltipTrigger
                      render={
                        <div
                          className={cn(
                            "size-[13px] rounded-[3px] ring-1 ring-inset ring-border/40 transition-colors",
                            levelClass[level],
                          )}
                        />
                      }
                    />
                    <TooltipContent side="top" className="max-w-72 text-xs">
                      <p className="font-medium">{new Date(`${day.date}T00:00:00`).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>
                      {day.problems.length ? <ul className="mt-1.5 space-y-1">{day.problems.map((problem, index) => <li key={`${problem.title}-${index}`} className="flex gap-2"><span className="max-w-48 truncate">{problem.title}</span>{problem.language && <span className="text-muted-foreground">{problem.language}</span>}</li>)}</ul> : <p className="mt-1 text-muted-foreground">푼 문제 없음</p>}
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
