const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")
const { test } = require("node:test")

test("계정당 새 브라우저 연결은 최대 5개까지만 허용한다", async () => {
  const {
    EXTENSION_CONNECTION_LIMIT_ERROR,
    MAX_EXTENSION_CONNECTIONS,
    canConnectExtensionInstallation,
    isExtensionConnectionLimitError,
  } = await import("../lib/extension-connect.ts")
  const fiveConnections = ["one", "two", "three", "four", "five"]

  assert.equal(MAX_EXTENSION_CONNECTIONS, 5)
  assert.equal(canConnectExtensionInstallation(fiveConnections.slice(0, 4), "five"), true)
  assert.equal(canConnectExtensionInstallation(fiveConnections, "six"), false)
  assert.equal(canConnectExtensionInstallation(fiveConnections, "three"), true)
  assert.equal(isExtensionConnectionLimitError({ message: EXTENSION_CONNECTION_LIMIT_ERROR }), true)
})

test("DB 트리거가 동시 연결 요청에도 5개 제한을 강제한다", () => {
  const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8")
  const migration = readFileSync(join(process.cwd(), "supabase/extension-connection-limit.sql"), "utf8")

  for (const sql of [schema, migration]) {
    assert.match(sql, /pg_advisory_xact_lock/)
    assert.match(sql, /count\(\*\)[\s\S]*>= 5/)
    assert.match(sql, /EXTENSION_CONNECTION_LIMIT_REACHED/)
    assert.match(sql, /before insert on public\.extension_connections/)
  }
})
