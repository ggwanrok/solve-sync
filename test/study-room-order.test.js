import assert from "node:assert/strict"
import test from "node:test"
import { moveStudyRoom, normalizeStudyRoomOrder, reconcileStudyRoomOrder } from "../lib/study-room-order.ts"

test("스터디룸을 옮겨도 다른 방의 상대 순서와 원본은 유지한다", () => {
  const original = ["a", "b", "c", "d"]
  assert.deepEqual(moveStudyRoom(original, "a", "d"), ["b", "c", "d", "a"])
  assert.deepEqual(moveStudyRoom(original, "d", "a"), ["d", "a", "b", "c"])
  assert.deepEqual(original, ["a", "b", "c", "d"])
})

test("참여 중인 방이 바뀌면 나간 방을 제외하고 새 방을 끝에 추가한다", () => {
  assert.deepEqual(reconcileStudyRoomOrder(["a", "b", "new"], ["b", "left", "a", "b"]), ["b", "a", "new"])
  assert.deepEqual(reconcileStudyRoomOrder([], ["left"]), [])
})

test("저장할 스터디룸 ID의 형식과 중복을 검증한다", () => {
  const first = "abcdefab-1234-4234-8234-abcdefabcdef"
  const second = "12345678-1234-4234-8234-123456789012"
  assert.deepEqual(normalizeStudyRoomOrder([second, first.toUpperCase()]), [second, first])
  for (const input of [null, {}, first, [first, first], [first, first.toUpperCase()], [null], [1], ["invalid"]]) {
    assert.equal(normalizeStudyRoomOrder(input), null)
  }
})
