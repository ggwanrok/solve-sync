const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { test } = require("node:test")
const vm = require("node:vm")
const ts = require("typescript")
const { createClient } = require("@supabase/supabase-js")

const routeSource = readFileSync(new URL("../app/api/events/programmers/accepted/route.ts", `file://${__filename}`), "utf8")
const routeScript = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

async function acceptedRoute({ duplicate = false } = {}) {
  const writes = []
  const client = createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const table = new URL(input).pathname.split("/").at(-1)
      if (init.method === "GET") {
        const rows = table === "extension_connections"
          ? [{ user_id: "viewer" }]
          : [{ problem_memo_prompt_enabled: false }]
        return Response.json(rows)
      }
      writes.push({ table, method: init.method, body: JSON.parse(init.body) })
      return Response.json(table === "solve_events" && init.method === "POST" && !duplicate ? [{ id: "solve" }] : [])
    } },
  })
  const modules = {
    "node:crypto": require("node:crypto"),
    "@supabase/supabase-js": { createClient: () => client },
    "next/server": require("next/server"),
    "@/lib/problem-type": await import("../lib/problem-type.ts"),
    "@/lib/programmers-language": await import("../lib/programmers-language.ts"),
  }
  const context = vm.createContext({
    exports: {},
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected route dependency: ${name}`)
      return modules[name]
    },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "test-key" } },
    console,
  })
  vm.runInContext(routeScript, context)
  return {
    writes,
    post: (input) => context.exports.POST(new Request("https://example.com/api/events/programmers/accepted", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-token" },
      body: JSON.stringify({
        problemId: "42860", title: "조이스틱",
        url: "https://school.programmers.co.kr/learn/courses/30/lessons/42860",
        ...input,
      }),
    })),
  }
}

test("오래된 확장 프로그램이 제목을 언어로 보내도 풀이 자체는 저장한다", async () => {
  const route = await acceptedRoute()
  const response = await route.post({ language: "조이스틱", difficulty: 2 })
  assert.equal(response.status, 201)
  const saved = route.writes.find((write) => write.table === "solve_events" && write.method === "POST").body
  assert.equal(saved.title, "조이스틱")
  assert.equal(saved.language, null)
  assert.equal(saved.difficulty, 2)
})

test("재전송된 잘못된 언어가 기존 풀이의 정상 언어를 덮어쓰지 않는다", async () => {
  const route = await acceptedRoute({ duplicate: true })
  const response = await route.post({ language: "제출 내역" })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).duplicate, true)
  const metadata = route.writes.find((write) => write.table === "solve_events" && write.method === "PATCH").body
  assert.equal(Object.hasOwn(metadata, "language"), false)
})

test("정상 SQL 언어는 신규 저장과 중복 풀이 보강에 반영한다", async () => {
  for (const duplicate of [false, true]) {
    const route = await acceptedRoute({ duplicate })
    const response = await route.post({ language: "  MySQL  " })
    assert.equal(response.status, duplicate ? 200 : 201)
    const saved = route.writes.find((write) => write.table === "solve_events" && write.method === (duplicate ? "PATCH" : "POST")).body
    assert.equal(saved.language, "MySQL")
    assert.equal(saved.problem_type, "sql")
  }
})
