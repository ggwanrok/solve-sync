import type { ProblemType } from "@/lib/problem-type"

export type StudyRoomProfile = {
  handle: string
  nickname: string
  avatar_url: string | null
}

export type StudyRoomMember = {
  userId: string
  role: string
  joinedAt: string
  profile: StudyRoomProfile | null
}

export type StudyRoomDetailData = {
  room: {
    id: string
    ownerId: string
    name: string
    description: string
    goalPeriod: "daily" | "weekly"
    goalCount: number
    minDifficulty: number
    isPrivate: boolean
  } | null
  members: StudyRoomMember[]
  progress: Array<{ userId: string; solvedCount: number }>
  isMember: boolean
  canView: boolean
  currentPeriod: { start: string; end: string } | null
}

export type StudyHistoryRow = {
  period_start: string
  period_end: string
  period_number: number
  user_id: string
  role: string
  handle: string
  nickname: string
  avatar_url: string | null
  solved_count: number
}

export type StudyHistoryPageData = {
  entries: StudyHistoryRow[]
  page: number
  pageSize: number
  totalPeriods: number
  totalPages: number
}

export type StudyPeriodProblemRow = {
  problem_id: string
  title: string
  url: string
  language: string | null
  problem_type: ProblemType
  difficulty: number | null
  accepted_at: string
}
