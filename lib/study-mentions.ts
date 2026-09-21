export type StudyMentionCandidate = {
  id: string
  nickname: string
}

export type StudyMentionTextPart = {
  text: string
  mentionUserId?: string
}

const MAX_NICKNAME_LENGTH = 20

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function mentionNickname(value: string) {
  return Array.from(value.trim().replace(/\s+/gu, " ")).slice(0, MAX_NICKNAME_LENGTH).join("")
}

function mentionRanges(message: string, candidates: StudyMentionCandidate[]) {
  const ranges: Array<{ start: number; end: number; userId: string }> = []
  const sortedCandidates = [...candidates]
    .map((candidate) => ({ ...candidate, nickname: mentionNickname(candidate.nickname) }))
    .filter((candidate) => candidate.nickname.length > 0)
    .sort((first, second) => Array.from(second.nickname).length - Array.from(first.nickname).length)

  for (const candidate of sortedCandidates) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}_])@${escapeRegExp(candidate.nickname)}(?=$|[^\\p{L}\\p{N}_])`,
      "giu",
    )
    for (const match of message.matchAll(pattern)) {
      const prefixLength = match[1]?.length || 0
      const start = (match.index || 0) + prefixLength
      const end = (match.index || 0) + match[0].length
      if (!ranges.some((range) => start < range.end && end > range.start)) {
        ranges.push({ start, end, userId: candidate.id })
      }
    }
  }

  return ranges.sort((first, second) => first.start - second.start || first.end - second.end)
}

export function extractStudyMentionedUserIds(message: string, candidates: StudyMentionCandidate[]) {
  return Array.from(new Set(mentionRanges(message, candidates).map((range) => range.userId)))
}

export function splitStudyMentionText(message: string, candidates: StudyMentionCandidate[]): StudyMentionTextPart[] {
  const ranges = mentionRanges(message, candidates)
  if (ranges.length === 0) return [{ text: message }]

  const parts: StudyMentionTextPart[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) parts.push({ text: message.slice(cursor, range.start) })
    parts.push({ text: message.slice(range.start, range.end), mentionUserId: range.userId })
    cursor = range.end
  }
  if (cursor < message.length) parts.push({ text: message.slice(cursor) })
  return parts
}

export function studyMentionQuery(message: string) {
  const match = message.match(/(?:^|\s)@([^\n]{0,20})$/u)
  return match ? match[1].replace(/\s+/gu, " ").trimStart().toLocaleLowerCase() : null
}
