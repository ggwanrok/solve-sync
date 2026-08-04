export const APP_TIME_ZONE = "Asia/Seoul"

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Returns a calendar date in the app's time zone without relying on the server's time zone. */
export function dayKey(date: Date) {
  const parts = dayFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) throw new Error("날짜를 변환할 수 없습니다.")
  return `${year}-${month}-${day}`
}

/** Adds days to a YYYY-MM-DD calendar date without introducing a time-zone shift. */
export function addCalendarDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}
