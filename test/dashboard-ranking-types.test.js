import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

// 운영 DB에 접근하지 않고 빈 테스트 DB에서 실행한 뒤 모두 롤백한다.
test("유형별 랭킹의 기본값, 점수, 동점 정렬, 페이지, 내 통계와 권한을 검증한다", {
  skip: !process.env.DASHBOARD_TEST_DATABASE_URL && !process.env.DASHBOARD_TEST_PGLITE_MODULE,
}, async () => {
  const schema = readFileSync("supabase/schema.sql", "utf8")
  const table = (name) => {
    const start = schema.indexOf(`create table if not exists public.${name} (`)
    return schema.slice(start, schema.indexOf("\n);", start) + 3)
  }
  const migration = (path) => readFileSync(path, "utf8").replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "")
  const { rankingBreakdown } = await import("../lib/ranking.ts")
  const sqlScore = rankingBreakdown([...Array(101).fill(5), null]).rankingScore
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
    alter table public.solve_events alter column accepted_at set default now();
    alter table public.solve_events enable row level security;
    create policy own_solves on public.solve_events for select to authenticated using (user_id = auth.uid());
    grant select on public.solve_events to authenticated;
    ${migration("supabase/dashboard-ranking.sql")}
    ${migration("supabase/dashboard-pagination.sql")}
    ${migration("supabase/dashboard-ranking-types.sql")}
    ${migration("supabase/dashboard-ranking-types.sql")}
    insert into auth.users select md5('user:' || n)::uuid from generate_series(1, 25) n;
    insert into public.profiles (id, handle, nickname)
      select md5('user:' || n)::uuid, case when n <= 24 then 'user_' || lpad(n::text, 3, '0') end, '사용자 ' || n
      from generate_series(1, 25) n;
    insert into public.solve_events (user_id, problem_id, url, problem_type, difficulty)
      select md5('user:' || u)::uuid, 'algo:' || n, 'https://example.com/' || n, 'algorithm', 5
      from generate_series(1, 20) u cross join generate_series(1, 101) n;
    insert into public.solve_events (user_id, problem_id, url, problem_type, difficulty)
      select md5('user:21')::uuid, 'sql:' || n, 'https://example.com/' || n, 'sql',
        case when n <= 101 then 5 end
      from generate_series(1, 102) n;
    insert into public.solve_events (user_id, problem_id, url, problem_type, difficulty) values
      (md5('user:21')::uuid, 'algo:1', 'https://example.com/1', 'algorithm', 1),
      (md5('user:21')::uuid, 'algo:2', 'https://example.com/2', 'algorithm', 1),
      (md5('user:22')::uuid, 'algo:1', 'https://example.com/1', 'algorithm', 5),
      (md5('user:23')::uuid, 'algo:1', 'https://example.com/1', 'algorithm', 5),
      (md5('user:23')::uuid, 'algo:2', 'https://example.com/2', 'algorithm', null),
      (md5('user:20')::uuid, 'sql:1', 'https://example.com/1', 'sql', 5),
      (md5('user:1')::uuid, 'sql:1', 'https://example.com/1', 'sql', 0);
    select set_config('request.jwt.claim.sub', md5('user:21')::text, true);
    set local role authenticated;
    do $$
    declare result jsonb; viewer jsonb; all_entries jsonb; kind text;
    begin
      result := public.dashboard_ranking_page();
      assert result = public.dashboard_ranking_page(1, 'algorithm'), '기본 유형은 알고리즘';
      assert result = public.dashboard_ranking_page(1, null), 'null 유형은 알고리즘';
      assert result = public.dashboard_ranking_page(1, 'all'), '합산 유형 입력도 알고리즘으로 보정';
      assert result->'entries'->0->>'handle' = 'user_001', '다른 유형 점수가 동점 정렬에 영향을 주지 않음';
      viewer := result->'viewer';
      assert (viewer->>'ranking_position')::int = 23, '페이지 밖 내 알고리즘 순위';
      assert (viewer->>'ranking_score')::int = 17, '알고리즘 자체 점수';
      assert (viewer->>'total_solved')::int = 2, '알고리즘 풀이 수';
      assert (viewer->>'level_1_solved')::int = 2 and (viewer->>'level_5_solved')::int = 0, '알고리즘 난이도 분포';
      assert (viewer->>'unknown_solved')::int = 0, 'SQL의 미확인 난이도 제외';
      assert (viewer->>'sql_score')::int = ${sqlScore}, '회원 상세의 다른 유형 점수 보존';
      result := public.dashboard_ranking_page(3, 'algorithm');
      assert result->'entries'->0->>'handle' = 'user_023', '동점이면 해당 유형 풀이 수 내림차순';
      assert result->'entries'->1->>'handle' = 'user_022', '풀이 수가 적으면 후순위';
      result := public.dashboard_ranking_page(1, 'sql');
      viewer := result->'viewer';
      assert result->'entries'->0->>'handle' = 'user_021', '전체 회원을 SQL 점수로 재정렬';
      assert (viewer->>'ranking_position')::int = 1, '내 SQL 순위';
      assert (viewer->>'ranking_score')::int = ${sqlScore}, '상위 100문제와 보너스를 반영한 SQL 점수, 축소 없음';
      assert (viewer->>'total_solved')::int = 102, 'SQL 풀이 수';
      assert (viewer->>'level_5_solved')::int = 101 and (viewer->>'level_1_solved')::int = 0, 'SQL 난이도 분포';
      assert (viewer->>'unknown_solved')::int = 1, 'SQL 미확인 난이도';
      assert (viewer->>'algorithm_score')::int = 17, '회원 상세의 알고리즘 점수 보존';
      foreach kind in array array['algorithm', 'sql'] loop
        result := public.dashboard_ranking_page(2147483647, kind);
        assert (result->>'totalCount')::int = 24 and (result->>'page')::int = 3, '유형별 인원과 마지막 페이지';
        assert jsonb_array_length(result->'entries') = 4, '마지막 페이지 크기';
        assert (public.dashboard_ranking_page(0, kind)->>'page')::int = 1, '0 페이지 보정';
        assert (public.dashboard_ranking_page(null, kind)->>'page')::int = 1, 'null 페이지 보정';
        select jsonb_agg(entry) into all_entries from generate_series(1, 3) p,
          lateral jsonb_array_elements(public.dashboard_ranking_page(p, kind)->'entries') entry;
        assert jsonb_array_length(all_entries) = 24, '모든 페이지 조회';
        assert (select count(distinct entry->>'user_id') from jsonb_array_elements(all_entries) entry) = 24, '동점·0점 회원도 중복이나 누락 없음';
      end loop;
      assert not has_function_privilege('anon', 'public.dashboard_ranking_page(integer,text)', 'execute'), '익명 접근 차단';
      assert to_regprocedure('public.dashboard_ranking(integer)') is null, '합산 랭킹 제거';
      assert to_regprocedure('public.dashboard_ranking_page(integer)') is null, '기존 오버로드 제거';
    end $$;
    select set_config('request.jwt.claim.sub', md5('user:24')::text, true);
    do $$ begin
      assert (public.dashboard_ranking_page(1, 'sql')->'viewer'->>'ranking_score')::int = 0, '해당 유형 풀이가 없으면 0점';
    end $$;
    select set_config('request.jwt.claim.sub', md5('user:25')::text, true);
    do $$ begin
      assert public.dashboard_ranking_page(1, 'sql')->'viewer' = 'null'::jsonb, '미등록 회원';
    end $$;
    reset role;
    update public.profiles set handle = null;
    set local role authenticated;
    do $$ begin
      assert public.dashboard_ranking_page(9, 'sql') = '{"entries":[],"viewer":null,"page":1,"totalCount":0}'::jsonb, '빈 SQL 랭킹';
    end $$;
    select set_config('request.jwt.claim.sub', '', true);
    do $$ begin
      assert public.dashboard_ranking_page(1, 'sql') is null, '인증 정보가 없으면 랭킹 미반환';
    end $$;
    rollback;
  `
  if (process.env.DASHBOARD_TEST_PGLITE_MODULE) {
    const { PGlite } = await import(process.env.DASHBOARD_TEST_PGLITE_MODULE)
    const db = new PGlite()
    try {
      await db.exec(sql)
    } finally {
      await db.close()
    }
  } else {
    const result = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", process.env.DASHBOARD_TEST_DATABASE_URL], {
      input: sql, encoding: "utf8", timeout: 60_000,
    })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
  }
})
