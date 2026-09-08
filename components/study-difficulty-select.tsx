"use client"

import { useId, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/difficulty"

export function StudyDifficultySelect({ defaultValue }: { defaultValue: DifficultyLevel }) {
  const [value, setValue] = useState<DifficultyLevel>(defaultValue)
  const id = useId()

  return (
    <div className="relative min-w-0">
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="absolute -top-2 left-3 z-10 bg-card px-1.5 text-xs leading-4 text-muted-foreground"
      >
        포함할 방 난이도
      </label>
      <Select
        name="minDifficulty"
        value={String(value)}
        onValueChange={(nextValue) => {
          if (nextValue !== null) setValue(Number(nextValue) as DifficultyLevel)
        }}
      >
        <SelectTrigger
          id={id}
          aria-labelledby={`${id}-label ${id}-value`}
          className="w-full border-input bg-card px-3.5 font-normal shadow-none ring-0 focus-visible:ring-2 data-[size=default]:h-11 dark:bg-card dark:hover:bg-card"
        >
          <SelectValue id={`${id}-value`}>Lv.{value} 이상</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} className="p-1">
          {DIFFICULTY_LEVELS.map((level) => (
            <SelectItem key={level} value={String(level)} className="min-h-9 px-3 pr-8">
              Lv.{level} 이상
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
