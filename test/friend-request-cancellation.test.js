import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"

test("보낸 사람은 대기 중인 자신의 친구 요청만 취소할 수 있다", async () => {
  const sources = await Promise.all([
    "supabase/schema.sql",
    "supabase/cancel-friend-request.sql",
  ].map((path) => readFile(join(process.cwd(), path), "utf8")))

  for (const source of sources) {
    assert.match(source, /create or replace function public\.cancel_friend_request\(request_id uuid\)/)
    assert.match(source, /where id = request_id and sender_id = current_user_id and status = 'pending'/)
    assert.match(source, /pg_advisory_xact_lock/)
    assert.match(source, /delete from public\.friend_requests/)
    assert.match(source, /revoke execute on function public\.cancel_friend_request\(uuid\) from public, anon/)
    assert.match(source, /grant execute on function public\.cancel_friend_request\(uuid\) to authenticated/)
  }
})
