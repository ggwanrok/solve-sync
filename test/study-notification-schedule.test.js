import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()

test("study notification crons run at 18:00 and 06:00 KST", async () => {
  const config = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"))

  assert.deepEqual(config.crons, [
    { path: "/api/cron/study-goal-reminders", schedule: "0 9 * * *" },
    { path: "/api/cron/study-goal-briefings", schedule: "0 21 * * *" },
  ])
})

test("missed-goal notifications run every morning and weekly checks only on Monday", async () => {
  const migration = await readFile(join(root, "supabase/study-notification-schedule.sql"), "utf8")

  assert.match(migration, /notification_phase = 'reminder'/)
  assert.match(migration, /notification_phase = 'briefing'/)
  assert.match(migration, /room\.goal_period = 'daily'/)
  assert.match(migration, /room\.goal_period = 'weekly' and extract\(isodow from local_run_at\) = 1/)
  assert.match(migration, /select candidate\.study_id, candidate\.user_id, 'goal_missed'/)
  assert.doesNotMatch(migration, /select room\.id, recipient\.user_id, 'period_summary'/)
})

test("scheduled pushes only claim fresh notifications for their phase", async () => {
  const migration = await readFile(join(root, "supabase/study-notification-schedule.sql"), "utf8")

  assert.match(migration, /notification_phase = 'reminder' and notification\.type = 'goal_reminder'/)
  assert.match(migration, /notification_phase = 'briefing' and notification\.type = 'goal_missed'/)
  assert.match(migration, /notification\.created_at >= now\(\) - interval '12 hours'/)
})

test("fresh and existing databases stop creating period summaries", async () => {
  const sources = await Promise.all([
    "supabase/schema.sql",
    "supabase/remove-study-period-summary.sql",
  ].map((path) => readFile(join(root, path), "utf8")))

  for (const source of sources) {
    assert.match(source, /select candidate\.study_id, candidate\.user_id, 'goal_missed'/)
    assert.match(source, /notification_phase = 'briefing' and notification\.type = 'goal_missed'/)
    assert.doesNotMatch(source, /select room\.id, recipient\.user_id, 'period_summary'/)
    assert.doesNotMatch(source, /'period-summary:' \|\|/)
  }
})
