const studyRoomTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export function formatStudyRoomTime(value: string) {
  return studyRoomTimeFormatter.format(new Date(value))
}
