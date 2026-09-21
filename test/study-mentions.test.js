import assert from "node:assert/strict"
import test from "node:test"
import { extractStudyMentionedUserIds, splitStudyMentionText, studyMentionQuery } from "../lib/study-mentions.ts"

const candidates = [
  { id: "user-1", nickname: "홍길동" },
  { id: "user-2", nickname: "김 철수" },
]

test("스터디 멘션은 멤버 닉네임으로만 대상자를 찾는다", () => {
  assert.deepEqual(
    extractStudyMentionedUserIds("@홍길동, @김 철수 확인 @없는사람", candidates),
    ["user-1", "user-2"],
  )
})

test("닉네임 멘션은 메시지 안에서 강조할 수 있는 구간으로 분리된다", () => {
  assert.deepEqual(splitStudyMentionText("안녕 @홍길동!", candidates), [
    { text: "안녕 " },
    { text: "@홍길동", mentionUserId: "user-1" },
    { text: "!" },
  ])
})

test("멘션 입력 검색어는 마지막 @ 구간에서 닉네임을 찾는다", () => {
  assert.equal(studyMentionQuery("안녕 @김 철"), "김 철")
  assert.equal(studyMentionQuery("안녕"), null)
})
