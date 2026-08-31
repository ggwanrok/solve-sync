const assert = require("node:assert/strict")
const { test } = require("node:test")

test("스터디룸 채팅 시간을 24시간제로 표시한다", async () => {
  const { formatStudyRoomTime } = await import("../lib/study-room-time.ts")
  const afternoon = new Date(2026, 7, 31, 15, 7).toISOString()
  const midnight = new Date(2026, 7, 31, 0, 7).toISOString()

  assert.match(formatStudyRoomTime(afternoon), /15:07$/)
  assert.match(formatStudyRoomTime(midnight), /00:07$/)
  assert.doesNotMatch(formatStudyRoomTime(afternoon), /오전|오후/)
})
