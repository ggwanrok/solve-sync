import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

test("대시보드 페이지 입력은 유효한 PostgreSQL 정수 범위로 제한한다", async () => {
  const { dashboardPage } = await import("../lib/dashboard.ts")
  for (const value of [undefined, null, "2", -1, 0, 1.5, NaN, Infinity]) {
    assert.equal(dashboardPage(value), 1)
  }
  assert.equal(dashboardPage(2), 2)
  assert.equal(dashboardPage(Number.MAX_SAFE_INTEGER), 2147483647)
})

// 명시적으로 지정한 테스트 전용 DB에서만 실행하며 모든 변경은 롤백한다.
test("실제 DB에서 전체 페이지, 통계, 기존 랭킹 산식과 접근 권한을 검증한다", {
  skip: !process.env.DASHBOARD_TEST_DATABASE_URL,
}, () => {
  const schema = readFileSync("supabase/schema.sql", "utf8")
  const table = (name) => {
    const start = schema.indexOf(`create table if not exists public.${name} (`)
    return schema.slice(start, schema.indexOf("\n);", start) + 3)
  }
  const migration = (path) => readFileSync(path, "utf8").replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "")
  const sql = `
    begin;
    create role authenticated;
    create role anon;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    ${table("profiles")}
    ${table("solve_events")}
    alter table public.solve_events enable row level security;
    create policy own_solves on public.solve_events for select to authenticated using (user_id = auth.uid());
    grant select on public.solve_events to authenticated;
    ${migration("supabase/dashboard-ranking.sql")}
    ${migration("supabase/dashboard-pagination.sql")}
    -- 마이그레이션을 다시 실행해도 안전한지 확인한다.
    ${migration("supabase/dashboard-pagination.sql")}
    insert into auth.users select md5('user:' || n)::uuid from generate_series(1, 122) n;
    insert into public.profiles (id, handle, nickname)
      select md5('user:' || n)::uuid, case when n <= 121 then 'user_' || lpad(n::text, 3, '0') end, '사용자 ' || n
      from generate_series(1, 122) n;
    insert into public.solve_events (id, user_id, problem_id, url, difficulty, accepted_at)
      select md5(u || ':' || n)::uuid, md5('user:' || u)::uuid, n::text,
        'https://school.programmers.co.kr/learn/courses/30/lessons/' || n, 5, now() - interval '20 days'
      from generate_series(1, 120) u cross join generate_series(1, 101) n;
    insert into public.solve_events (id, user_id, problem_id, url, problem_type, accepted_at)
      select md5('121:' || n)::uuid, md5('user:121')::uuid, n::text,
        'https://school.programmers.co.kr/learn/courses/30/lessons/' || n,
        case when n % 2 = 0 then 'sql' else 'algorithm' end,
        (((now() at time zone 'Asia/Seoul')::date - case
          when n <= 1000 then 10 when n = 1001 then 0 when n in (1002, 1003) then 1
          when n = 1004 then 2 else 4 end) + time '00:01') at time zone 'Asia/Seoul'
      from generate_series(1, 1005) n;
    select set_config('request.jwt.claim.sub', md5('user:121')::text, true);
    set local role authenticated;
    do $$
    declare result jsonb; all_entries jsonb; legacy jsonb;
    begin
      result := public.dashboard_solves_page(1);
      assert (result->>'totalCount')::int = 1005, '풀이 총 개수';
      assert jsonb_array_length(result->'entries') = 10, '첫 페이지 10개';
      assert result->'entries'->0->>'problem_id' = '1001', '서울 날짜 기준 최신순';
      assert (public.dashboard_solves_page(0)->>'page')::int = 1, '0 페이지 보정';
      assert (public.dashboard_solves_page(null)->>'page')::int = 1, 'null 페이지 보정';
      result := public.dashboard_solves_page(2147483647);
      assert (result->>'page')::int = 101, '범위 초과 시 마지막 페이지';
      assert jsonb_array_length(result->'entries') = 5, '마지막 페이지 나머지';
      select jsonb_agg(entry) into all_entries
        from generate_series(1, 101) p,
          lateral jsonb_array_elements(public.dashboard_solves_page(p)->'entries') entry;
      assert jsonb_array_length(all_entries) = 1005, '1000개 제한 없이 모든 풀이';
      assert (select count(distinct entry->>'id') from jsonb_array_elements(all_entries) entry) = 1005, '동일 시각 풀이 중복이나 누락 없음';
      assert not exists (
        select 1 from jsonb_array_elements(all_entries) entry
        where (entry->>'id')::uuid != md5('121:' || (entry->>'problem_id'))::uuid
      ), '다른 사용자의 풀이가 섞이지 않음';
      assert public.dashboard_solve_summary() = '{"totalSolved":1005,"currentStreak":3}'::jsonb, '전체 개수와 중간 공백 전 스트릭';
      result := public.dashboard_ranking_page(13);
      assert (result->>'totalCount')::int = 121, '전체 랭킹 인원';
      assert jsonb_array_length(result->'entries') = 1, '랭킹 마지막 페이지';
      assert (result->'entries'->0->>'ranking_position')::int = 121, '100위 이후 랭킹 조회';
      assert (public.dashboard_ranking_page(1)->'viewer'->>'ranking_position')::int = 121, '현재 페이지와 독립적인 내 순위';
      assert (public.dashboard_ranking_page(2147483647)->>'page')::int = 13, '랭킹 범위 초과';
      select jsonb_agg(entry order by (entry->>'ranking_position')::int) into all_entries
        from generate_series(1, 13) p,
          lateral jsonb_array_elements(public.dashboard_ranking_page(p)->'entries') entry;
      assert (select count(distinct entry->>'user_id') from jsonb_array_elements(all_entries) entry) = 121, '동점 랭킹 누락 없음';
      select jsonb_agg(to_jsonb(entry) order by entry.ranking_position) into legacy from public.dashboard_ranking(100) entry;
      assert legacy = (
        select jsonb_agg(entry order by (entry->>'ranking_position')::int) from jsonb_array_elements(all_entries) entry
        where (entry->>'ranking_position')::int <= 100 or entry->>'user_id' = auth.uid()::text
      ), '기존 점수 산식, 순위, 프로필 정보 보존';
      assert not has_function_privilege('anon', 'public.dashboard_ranking_page(integer)', 'execute'), '익명 랭킹 차단';
      assert not has_function_privilege('anon', 'public.dashboard_solves_page(integer)', 'execute'), '익명 풀이 차단';
      assert not has_function_privilege('anon', 'public.dashboard_solve_summary()', 'execute'), '익명 통계 차단';
    end $$;
    reset role;
    update public.solve_events set accepted_at = accepted_at - interval '1 day'
      where user_id = md5('user:121')::uuid and problem_id = '1001';
    set local role authenticated;
    do $$ begin
      assert (public.dashboard_solve_summary()->>'currentStreak')::int = 2, '오늘 미풀이 시 어제부터 스트릭';
    end $$;
    reset role;
    update public.solve_events set accepted_at = accepted_at - interval '3 days' where user_id = md5('user:121')::uuid;
    set local role authenticated;
    do $$ begin
      assert (public.dashboard_solve_summary()->>'currentStreak')::int = 0, '어제도 풀지 않았으면 0일';
    end $$;
    select set_config('request.jwt.claim.sub', md5('user:122')::text, true);
    do $$ begin
      assert public.dashboard_solves_page(9) = '{"entries":[],"page":1,"totalCount":0}'::jsonb, '빈 풀이 목록';
      assert public.dashboard_solve_summary() = '{"totalSolved":0,"currentStreak":0}'::jsonb, '빈 통계';
      assert public.dashboard_ranking_page(1)->'viewer' = 'null'::jsonb, '랭킹 미등록 사용자';
    end $$;
    reset role;
    update public.profiles set handle = null;
    set local role authenticated;
    do $$ begin
      assert public.dashboard_ranking_page(9) = '{"entries":[],"viewer":null,"page":1,"totalCount":0}'::jsonb, '빈 전체 랭킹';
    end $$;
    rollback;
  `
  const result = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", process.env.DASHBOARD_TEST_DATABASE_URL], {
    input: sql, encoding: "utf8", timeout: 60_000,
  })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
})
