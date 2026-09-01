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

test('확장 프로그램은 문제 메모를 독립 팝업 문서로 제공한다', () => {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), 'extension/manifest.json'), 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  const popup = readFileSync(join(process.cwd(), 'extension/problem-memo.html'), 'utf8');

  assert.deepEqual(scripts, ['content.js']);
  assert.match(popup, /problem-memo\.css/);
  assert.match(popup, /problem-memo\.js/);
  assert.doesNotMatch(popup, /\bdisabled\b/);
  for (const field of ['algorithmTags', 'approach', 'solutionCode', 'difficultyReason', 'learnings']) {
    assert.match(popup, new RegExp(`\\bname="${field}"`));
  }
});
