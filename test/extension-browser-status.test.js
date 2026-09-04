const assert = require("node:assert/strict")
const { test } = require("node:test")

const browserConnection = import("../lib/extension-browser-connection.ts")

function runtimeWithResponse(response) {
  return { sendMessage(_id, _message, callback) { callback(response) } }
}

test("현재 계정 연결, 다른 계정, 최초 연결, 재연결을 구분한다", async () => {
  const { requestExtensionBrowserStatus } = await browserConnection
  for (const [response, expected] of [
    [{ installed: true, connected: true, accountId: "current-account" }, "connected"],
    [{ installed: true, connected: true, accountId: "other-account" }, "different-account"],
    [{ installed: true, connected: false }, "disconnected"],
    [{ installed: true, connected: false, authRequired: true }, "reconnect-required"],
  ]) {
    assert.equal(await requestExtensionBrowserStatus(runtimeWithResponse(response), "current-account"), expected)
  }
})

test("감지 실패와 서버 확인 실패를 연결 해제로 단정하지 않는다", async () => {
  const { requestExtensionBrowserStatus } = await browserConnection
  assert.equal(await requestExtensionBrowserStatus(undefined, "account"), "not-detected")
  assert.equal(await requestExtensionBrowserStatus({
    lastError: { message: "Could not establish connection. Receiving end does not exist." },
    sendMessage(_id, _message, callback) { callback() },
  }, "account"), "not-detected")

  for (const response of [
    undefined,
    { installed: true },
    { installed: true, connected: true },
    { installed: true, connected: false, unavailable: true },
  ]) {
    assert.equal(await requestExtensionBrowserStatus(runtimeWithResponse(response), "account"), "unavailable")
  }
})

test("정상 연결 응답이 2초를 넘어도 연결됨으로 반영한다", async (t) => {
  const { requestExtensionBrowserStatus } = await browserConnection
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const status = requestExtensionBrowserStatus({
    sendMessage(_id, _message, callback) {
      setTimeout(() => callback({ installed: true, connected: true, accountId: "account" }), 2500)
    },
  }, "account")
  t.mock.timers.tick(2500)
  assert.equal(await status, "connected")
})

test("응답 제한을 넘으면 지연으로 표시하고 재확인으로 복구할 수 있다", async (t) => {
  const { requestExtensionBrowserStatus } = await browserConnection
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let lateResponse
  const first = requestExtensionBrowserStatus({
    sendMessage(_id, _message, callback) { lateResponse = callback },
  }, "account")
  t.mock.timers.tick(10_000)
  assert.equal(await first, "timeout")

  const second = requestExtensionBrowserStatus(runtimeWithResponse({
    installed: true, connected: true, accountId: "account",
  }), "account")
  lateResponse({ installed: true, connected: true, accountId: "old-account" })
  assert.equal(await second, "connected")
  assert.equal(await first, "timeout")
})

test("계정 변경이나 화면 이탈로 취소한 조회는 늦은 응답을 반영하지 않는다", async () => {
  const { requestExtensionBrowserStatus } = await browserConnection
  const controller = new AbortController()
  let respond
  const status = requestExtensionBrowserStatus({
    sendMessage(_id, _message, callback) { respond = callback },
  }, "old-account", controller.signal)
  controller.abort()
  respond({ installed: true, connected: true, accountId: "old-account" })
  assert.equal(await status, "unavailable")
})

test("기기 조회 실패를 0개로 표시하지 않고 계정 범위를 명시한다", async () => {
  const { registeredExtensionDevicesLabel } = await browserConnection
  assert.equal(registeredExtensionDevicesLabel(2), "계정에 등록된 기기 2개")
  assert.equal(registeredExtensionDevicesLabel(0), "계정에 등록된 기기 0개")
  assert.equal(registeredExtensionDevicesLabel(null), "계정에 등록된 기기 확인 불가")
})
