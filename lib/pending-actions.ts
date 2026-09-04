/** Synchronous locks: a second event can arrive before React renders disabled UI. */
export function createPendingActions() {
  let snapshot: ReadonlySet<string> = new Set()
  const listeners = new Set<() => void>()
  const publish = (next: Set<string>) => {
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    start(key = "default") {
      if (snapshot.has(key)) return false
      publish(new Set(snapshot).add(key))
      return true
    },
    finish(key = "default") {
      if (!snapshot.has(key)) return
      const next = new Set(snapshot)
      next.delete(key)
      publish(next)
    },
  }
}
