const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

test('문제 메모 자동 열기 개인 설정은 기본적으로 꺼져 있다', () => {
  const schema = readFileSync(join(process.cwd(), 'supabase/schema.sql'), 'utf8');
  const migration = readFileSync(join(process.cwd(), 'supabase/problem-memo-prompt.sql'), 'utf8');

  assert.match(schema, /problem_memo_prompt_enabled boolean not null default false/);
  assert.match(migration, /problem_memo_prompt_enabled boolean not null default false/);
});

test('확장 프로그램은 문제 메모 모달을 정답 감지 스크립트보다 먼저 로드한다', () => {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'extension/manifest.json'), 'utf8'));
  const scripts = manifest.content_scripts[0].js;

  assert.deepEqual(scripts.slice(-2), ['problem-memo-modal.js', 'content.js']);
});
