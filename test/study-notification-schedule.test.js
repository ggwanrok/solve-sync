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

test("daily briefings run every morning and weekly briefings only on Monday", async () => {
  const migration = await readFile(join(root, "supabase/study-notification-schedule.sql"), "utf8")

  assert.match(migration, /notification_phase = 'reminder'/)
  assert.match(migration, /notification_phase = 'briefing'/)
  assert.match(migration, /room\.goal_period = 'daily'/)
  assert.match(migration, /room\.goal_period = 'weekly' and extract\(isodow from local_run_at\) = 1/)
  assert.match(migration, /case when room\.goal_period = 'daily' then '어제는 ' else '지난주에는 ' end/)
})

test("scheduled pushes only claim fresh notifications for their phase", async () => {
  const migration = await readFile(join(root, "supabase/study-notification-schedule.sql"), "utf8")

  assert.match(migration, /notification_phase = 'reminder' and notification\.type = 'goal_reminder'/)
  assert.match(migration, /notification_phase = 'briefing' and notification\.type in \('goal_missed', 'period_summary'\)/)
  assert.match(migration, /notification\.created_at >= now\(\) - interval '12 hours'/)
})
