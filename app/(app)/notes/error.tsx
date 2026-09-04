"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function ProblemNotesError({ reset }: { reset: () => void }) {
  return (
    <div className="page-container max-w-3xl">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p role="alert" className="text-sm text-muted-foreground">문제 메모와 북마크를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          <Button type="button" variant="outline" onClick={reset}>다시 시도</Button>
        </CardContent>
      </Card>
    </div>
  )
}
