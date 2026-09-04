"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { createPendingActions } from "@/lib/pending-actions"

export function usePendingActions() {
  const [actions] = useState(createPendingActions)
  const keys = useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot)
  return { ...actions, keys }
}

export function usePendingAction() {
  const { keys, start, finish } = usePendingActions()
  return { pending: keys.has("default"), start, finish }
}

/** Keep the button busy through both the request and the resulting route update. */
export function useActionTransition() {
  const action = usePendingAction()
  const [transitionPending, startTransition] = useTransition()
  const pending = action.pending || transitionPending

  function run(callback: () => Promise<void> | void) {
    if (pending || !action.start()) return
    startTransition(async () => {
      try {
        await callback()
      } finally {
        action.finish()
      }
    })
  }

  return [pending, run] as const
}
