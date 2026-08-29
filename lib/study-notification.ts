export type StudyNotificationType = "goal_reminder" | "goal_missed" | "weekly_summary" | "period_summary" | "poke"

export type StudyNotification = {
  id: string
  studyId: string
  type: StudyNotificationType
  title: string
  body: string
  url: string
  createdAt: string
  readAt: string | null
}

export type StudyNotificationInbox = {
  items: StudyNotification[]
  unreadCount: number
}
