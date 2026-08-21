"use client"

import { Popover } from "@base-ui/react/popover"
import { Info } from "lucide-react"
import { RANKING_DIFFICULTY_POINTS, RANKING_SOLVE_BONUS_MAX, RANKING_TOP_PROBLEM_LIMIT } from "@/lib/ranking"

export function RankingFormulaHelp() {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="랭킹 점수 산출 방식 보기"
        title="랭킹 점수 산출 방식 보기"
        className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-popup-open:bg-accent data-popup-open:text-accent-foreground"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="isolate z-50">
          <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Popover.Title className="text-sm font-semibold">랭킹 점수 산출 방식</Popover.Title>
            <Popover.Description className="mt-1.5 text-xs leading-5 text-muted-foreground">
              알고리즘과 SQL에 같은 산식을 각각 적용한 뒤 SQL 점수를 2로 정수 나눗셈해 반영합니다.
            </Popover.Description>
            <div className="my-3 h-px bg-border" />
            <div className="space-y-2 text-xs leading-5">
              <p>
                <span className="font-medium">난이도 점수</span>
                <span className="ml-2 text-muted-foreground">Lv.0부터 Lv.5까지 {RANKING_DIFFICULTY_POINTS.join(" · ")}점</span>
              </p>
              <p>
                <span className="font-medium">풀이 보너스</span>
                <span className="ml-2 text-muted-foreground">유형별 최대 {RANKING_SOLVE_BONUS_MAX}점</span>
              </p>
              <p className="text-muted-foreground">유형별 난이도 상위 {RANKING_TOP_PROBLEM_LIMIT}문제까지 반영</p>
              <p className="rounded-lg bg-muted/55 px-3 py-2 font-mono text-[11px]">
                풀이 보너스 = 반올림[200 × (1 − 0.997<sup>총 풀이 수</sup>)]
              </p>
              <p className="rounded-lg bg-primary/8 px-3 py-2 font-mono text-[11px]">
                최종 점수 = 알고리즘 점수 + (SQL 점수 ÷ 2)
              </p>
              <p className="text-[11px] text-muted-foreground">SQL 점수를 나눈 결과의 소수점은 버립니다.</p>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
