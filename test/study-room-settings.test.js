import assert from "node:assert/strict"
import test from "node:test"
import { normalizeStudyRoomSettings } from "../lib/study-room-settings.ts"

const studyId = "abcdefab-1234-4234-8234-abcdefabcdef"

test("스터디룸 설정은 이름과 설명을 정리하고 허용된 값만 반환한다", () => {
  assert.deepEqual(normalizeStudyRoomSettings({
    studyId: studyId.toUpperCase(),
    name: "  매일 한 문제  ",
    description: "  같이 공부해요  ",
    isPrivate: false,
    password: "ignored-password",
    goalCount: 999,
    minDifficulty: 5,
  }), {
    studyId,
    name: "매일 한 문제",
    description: "같이 공부해요",
    isPrivate: false,
    password: null,
  })
})

test("비공개 전환용 비밀번호는 공백을 포함해 원문을 유지한다", () => {
  assert.equal(normalizeStudyRoomSettings({
    studyId,
    name: "스터디",
    description: "",
    isPrivate: true,
    password: " pass word ",
  })?.password, " pass word ")
})

test("잘못된 ID와 이름·설명·비밀번호 길이를 거부한다", () => {
  const valid = { studyId, name: "스터디", description: "", isPrivate: true, password: null }
  for (const input of [
    null,
    { ...valid, studyId: "invalid" },
    { ...valid, name: "   " },
    { ...valid, name: "가".repeat(31) },
    { ...valid, description: "가".repeat(101) },
    { ...valid, password: "a".repeat(51) },
    { ...valid, isPrivate: "true" },
  ]) {
    assert.equal(normalizeStudyRoomSettings(input), null)
  }
})
