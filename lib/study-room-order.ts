/** Keep an edited order in sync when study rooms are joined or left. */
export function reconcileStudyRoomOrder(studyRoomIds: readonly string[], preferredOrder: readonly string[]) {
  const remaining = new Set(studyRoomIds)
  const result: string[] = []
  for (const id of preferredOrder) {
    if (remaining.delete(id)) result.push(id)
  }
  return [...result, ...remaining]
}

export function moveStudyRoom(order: readonly string[], studyRoomId: string, targetId: string) {
  const from = order.indexOf(studyRoomId)
  const to = order.indexOf(targetId)
  const next = [...order]
  if (from < 0 || to < 0 || from === to) return next
  next.splice(from, 1)
  next.splice(to, 0, studyRoomId)
  return next
}

export function normalizeStudyRoomOrder(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of input) {
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return null
    const id = value.toLowerCase()
    if (seen.has(id)) return null
    seen.add(id)
    ids.push(id)
  }
  return ids
}
