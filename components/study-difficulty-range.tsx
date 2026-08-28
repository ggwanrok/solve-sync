"use client"

import { Slider } from "@base-ui/react/slider"
import { useState } from "react"
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/difficulty"

export function StudyDifficultyRange({ defaultValue }: { defaultValue: DifficultyLevel }) {
  const [value, setValue] = useState<DifficultyLevel>(defaultValue)

  return (
    <div className="rounded-xl bg-muted/55 px-4 py-3">
      <div>
        <p className="text-sm font-medium">Lv.{value}부터 Lv.5까지</p>
        <p className="mt-0.5 text-xs text-muted-foreground">왼쪽 기준점을 움직여 검색할 최소 난이도를 정하세요.</p>
      </div>

      <div className="mt-3">
        <Slider.Root
          value={value}
          onValueChange={(nextValue) => setValue(nextValue as DifficultyLevel)}
          min={DIFFICULTY_LEVELS[0]}
          max={DIFFICULTY_LEVELS.at(-1)}
          step={1}
          thumbAlignment="edge"
          name="minDifficulty"
        >
          <Slider.Control className="flex h-8 w-full touch-none items-center px-1 select-none">
            <Slider.Track className="relative h-2 w-full rounded-full bg-primary">
              <Slider.Indicator className="rounded-l-full bg-muted" />
              {DIFFICULTY_LEVELS.map((level) => (
                <span
                  key={level}
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-1/2 z-1 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${level >= value ? "bg-primary-foreground/80" : "bg-muted-foreground/40"}`}
                  style={{ left: `${(level / (DIFFICULTY_LEVELS.length - 1)) * 100}%` }}
                />
              ))}
              <Slider.Thumb
                aria-label="검색할 최소 방 난이도"
                aria-valuetext={`Lv.${value}부터 Lv.5까지`}
                className="z-2 size-5 rounded-full border-2 border-primary bg-background shadow-sm select-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
              />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <div className="flex justify-between px-1 text-[11px] font-medium text-muted-foreground" aria-hidden="true">
          {DIFFICULTY_LEVELS.map((level) => <span key={level}>Lv.{level}</span>)}
        </div>
      </div>
    </div>
  )
}
