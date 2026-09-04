"use client"

import { useState } from "react"
import { useActionTransition } from "@/lib/use-pending-action"
import type { DashboardResult } from "@/lib/dashboard"

export function useDashboardPage<T>(initialResult: DashboardResult<T>, fetchPage: (page: number) => Promise<DashboardResult<T>>) {
  const [data, setData] = useState(initialResult.ok ? initialResult.data : null)
  const [error, setError] = useState(initialResult.ok ? null : initialResult.message)
  const [pending, run] = useActionTransition()

  function loadPage(page: number) {
    run(async () => {
      setError(null)
      try {
        const result = await fetchPage(page)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setData(result.data)
      } catch {
        setError("목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")
      }
    })
  }

  return { data, error, pending, loadPage }
}
