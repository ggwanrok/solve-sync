const assert = require("node:assert/strict")
const { test } = require("node:test")

test("표준 브라우저 푸시 제공자의 HTTPS 구독 주소만 허용한다", async () => {
  const { isAllowedPushEndpoint } = await import("../lib/push-subscription.ts")

  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/example"), true)
  assert.equal(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/example"), true)
  assert.equal(isAllowedPushEndpoint("https://web.push.apple.com/QP/example"), true)
  assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/example"), false)
  assert.equal(isAllowedPushEndpoint("https://127.0.0.1/internal"), false)
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com.attacker.example/push"), false)
})

test("푸시 암호화 키는 URL-safe Base64 형식만 허용한다", async () => {
  const { isPushEncryptionKey } = await import("../lib/push-subscription.ts")

  assert.equal(isPushEncryptionKey("AbCdEf0123_-"), true)
  assert.equal(isPushEncryptionKey("AbCdEf0123=="), true)
  assert.equal(isPushEncryptionKey(""), false)
  assert.equal(isPushEncryptionKey("not a key"), false)
  assert.equal(isPushEncryptionKey("a".repeat(513)), false)
})
