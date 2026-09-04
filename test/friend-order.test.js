import assert from "node:assert/strict"
import test from "node:test"
import { moveFriend, normalizeFriendOrder, reconcileFriendOrder } from "../lib/friend-order.ts"

test("친구를 앞뒤로 옮겨도 다른 친구의 상대 순서와 원본은 유지한다", () => {
  const original = ["a", "b", "c", "d"]
  assert.deepEqual(moveFriend(original, "a", "d"), ["b", "c", "d", "a"])
  assert.deepEqual(moveFriend(original, "d", "a"), ["d", "a", "b", "c"])
  assert.deepEqual(moveFriend(original, "b", "c"), ["a", "c", "b", "d"])
  assert.deepEqual(original, ["a", "b", "c", "d"])
})

test("이미 삭제된 친구 또는 같은 위치로 이동하는 경우 목록을 손상시키지 않는다", () => {
  const order = ["a", "b"]
  assert.deepEqual(moveFriend(order, "removed", "b"), order)
  assert.deepEqual(moveFriend(order, "a", "removed"), order)
  assert.deepEqual(moveFriend(order, "a", "a"), order)
  assert.deepEqual(moveFriend([], "a", "b"), [])
})

test("편집 중 친구가 바뀌면 삭제된 친구를 제외하고 새 친구를 끝에 추가한다", () => {
  assert.deepEqual(reconcileFriendOrder(["a", "b", "new"], ["b", "removed", "a", "b"]), ["b", "a", "new"])
  assert.deepEqual(reconcileFriendOrder(["a", "b"], []), ["a", "b"])
  assert.deepEqual(reconcileFriendOrder([], ["removed"]), [])
})

test("저장할 친구 ID는 순서를 보존하며 UUID 대소문자를 통일한다", () => {
  const id = "abcdefab-1234-4234-8234-abcdefabcdef"
  const second = "12345678-1234-4234-8234-123456789012"
  assert.deepEqual(normalizeFriendOrder([second, id.toUpperCase()]), [second, id])
  assert.deepEqual(normalizeFriendOrder([]), [])
})

test("중복·잘못된 ID와 배열이 아닌 저장 입력을 거부한다", () => {
  const id = "abcdefab-1234-4234-8234-abcdefabcdef"
  for (const input of [null, {}, id, [id, id], [id, id.toUpperCase()], [null], [1], ["invalid"], [[id]]]) {
    assert.equal(normalizeFriendOrder(input), null)
  }
})
