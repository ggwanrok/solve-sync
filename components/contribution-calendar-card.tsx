"use client"

import { useState } from "react"
import { ContributionGraph, type ContributionDay } from "@/components/contribution-graph"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type ContributionYear = {
  year: number
  days: ContributionDay[]
}

export function ContributionCalendarCard({
  years,
  initialYear,
}: {
  years: ContributionYear[]
  initialYear: number
}) {
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const selected = years.find(({ year }) => year === selectedYear) || years[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">나의 잔디</CardTitle>
        <CardDescription>{selected.year}년 난이도와 풀이량을 반영한 학습 강도</CardDescription>
        <CardAction>
          <Select
            value={String(selected.year)}
            onValueChange={(value) => value && setSelectedYear(Number(value))}
          >
            <SelectTrigger size="sm" aria-label="잔디 연도 선택">
              <SelectValue>{selected.year}년</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {years.map(({ year }) => (
                <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent><ContributionGraph data={selected.days} /></CardContent>
    </Card>
  )
}
