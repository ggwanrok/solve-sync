import assert from "node:assert/strict"
import test from "node:test"
import { createPendingActions } from "../lib/pending-actions.ts"
import { nextPokeExpiration, pokeExpiresAt, POKE_COOLDOWN_MS } from "../lib/study-poke.ts"

test("같은 대상의 연속 클릭은 한 번만 실행하고 다른 대상은 함께 처리한다", async () => {
  const actions = createPendingActions()
  const requests = new Map()
  const calls = []
  async function send(id) {
    if (!actions.start(id)) return
    calls.push(id)
    try {
      await new Promise((resolve, reject) => requests.set(id, { resolve, reject }))
    } finally {
      actions.finish(id)
    }
  }
  const first = send("poke:user1")
  const duplicate = send("poke:user1")
  const second = send("poke:user2")
  assert.deepEqual(calls, ["poke:user1", "poke:user2"])
  assert.deepEqual([...actions.getSnapshot()], ["poke:user1", "poke:user2"])
  requests.get("poke:user2").resolve()
  await second
  assert.deepEqual([...actions.getSnapshot()], ["poke:user1"])
  requests.get("poke:user1").resolve()
  await Promise.all([first, duplicate])
  assert.equal(actions.getSnapshot().size, 0)
})

test("실패한 대상만 잠금을 해제하며 다시 시도할 수 있다", async () => {
  const actions = createPendingActions()
  actions.start("memo:other")
  async function save() {
    if (!actions.start("memo:failed")) return
    try { throw new Error("network failure") } finally { actions.finish("memo:failed") }
  }
  await assert.rejects(save(), /network failure/)
  assert.equal(actions.getSnapshot().has("memo:other"), true)
  assert.equal(actions.start("memo:failed"), true)
})

test("같은 멤버의 친구 신청과 콕 찌르기는 서로의 처리 표시를 바꾸지 않는다", () => {
  const actions = createPendingActions()
  actions.start("friend:user1")
  actions.start("poke:user1")
  const duringBoth = actions.getSnapshot()
  actions.finish("friend:user1")
  assert.equal(actions.getSnapshot().has("poke:user1"), true)
  assert.deepEqual([...duringBoth], ["friend:user1", "poke:user1"])
})

test("화면 구독을 해제한 뒤 요청이 완료되어도 이전 화면에 통지하지 않는다", () => {
  const actions = createPendingActions()
  let updates = 0
  const unsubscribe = actions.subscribe(() => updates++)
  actions.start()
  actions.start()
  assert.equal(updates, 1)
  unsubscribe()
  actions.finish()
  assert.equal(updates, 1)
})

test("콕 완료 상태는 오래된 서버 응답에도 유지되고 각 멤버의 10분 제한이 따로 만료된다", () => {
  const now = Date.parse("2026-09-04T12:00:00Z")
  const first = pokeExpiresAt("2026-09-04T11:55:00Z")
  const second = pokeExpiresAt(null, now + POKE_COOLDOWN_MS)
  assert.equal(pokeExpiresAt("invalid", second), second)
  assert.equal(pokeExpiresAt("2026-09-04T11:00:00Z", second), second)
  assert.equal(nextPokeExpiration([first, second], now), first)
  assert.equal(nextPokeExpiration([first, second], first), second)
  assert.equal(nextPokeExpiration([first, second], second), null)
  assert.equal(nextPokeExpiration([], now), null)
})
