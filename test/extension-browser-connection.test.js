const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const backgroundScript = readFileSync(new URL('../extension/background.js', `file://${__filename}`), 'utf8')
  .replace("import { API_BASE } from './config.js';", "const API_BASE = 'https://solve-sync.vercel.app';");

function loadBackground({ token = '', connection = null, fetchResponse } = {}) {
  const stored = { token, connection, 'sync-state': {} };
  const sessionStored = {};
  const createdWindows = [];
  let externalListener = null;
  let fetchCount = 0;
  const event = { addListener() {} };
  const context = vm.createContext({
    AbortController,
    console,
    crypto: webcrypto,
    fetch: async () => {
      fetchCount += 1;
      return fetchResponse || { ok: false, status: 503, json: async () => ({ error: 'unavailable' }) };
    },
    navigator: { userAgent: 'Chrome' },
    setTimeout,
    clearTimeout,
    TextEncoder,
    URL,
    chrome: {
      alarms: { get: async () => ({}), create: async () => {}, onAlarm: event },
      identity: { getRedirectURL: () => 'https://example.chromiumapp.org/solvesync' },
      runtime: {
        getURL: (path) => `chrome-extension://solvesync/${path}`,
        onInstalled: event,
        onMessage: event,
        onMessageExternal: { addListener(listener) { externalListener = listener; } },
        onStartup: event,
      },
      storage: {
        local: {
          async get(defaults) {
            return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, stored[key] ?? fallback]));
          },
          async remove(keys) {
            for (const key of keys) delete stored[key];
          },
          async set(values) {
            Object.assign(stored, values);
          },
        },
        session: {
          async get(key) {
            return { [key]: sessionStored[key] };
          },
          async remove(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete sessionStored[key];
          },
          async set(values) {
            Object.assign(sessionStored, values);
          },
        },
      },
      windows: {
        async create(options) {
          createdWindows.push(options);
          return { id: 7 };
        },
        onRemoved: event,
      },
    },
  });
  vm.runInContext(backgroundScript, context);
  return { context, stored, sessionStored, createdWindows, listener: () => externalListener, fetchCount: () => fetchCount };
}

function requestStatus(listener, senderUrl = 'https://solve-sync.vercel.app/') {
  return new Promise((resolve, reject) => {
    const keepChannelOpen = listener({ type: 'GET_CONNECTION_STATUS' }, { url: senderUrl }, resolve);
    if (keepChannelOpen !== true) reject(new Error('external response channel was not opened'));
  });
}

test('현재 브라우저의 유효한 연동 계정을 웹 앱에 전달한다', async () => {
  const accountId = 'e35b9225-0c0c-4ab4-9012-f2f56a9c70a5';
  const background = loadBackground({
    token: 'secret-extension-token',
    fetchResponse: {
      ok: true,
      status: 200,
      json: async () => ({ connected: true, accountId, connection: { deviceName: 'Mac · Chrome' } }),
    },
  });

  const status = await requestStatus(background.listener());
  assert.equal(status.connected, true);
  assert.equal(status.accountId, accountId);
  assert.equal(background.fetchCount(), 1);
});

test('현재 브라우저에 토큰이 없으면 계정 전체 연동 이력과 무관하게 미연동으로 응답한다', async () => {
  const background = loadBackground();
  const status = await requestStatus(background.listener());

  assert.equal(status.installed, true);
  assert.equal(status.connected, false);
  assert.equal(background.fetchCount(), 0);
});

test('허용하지 않은 웹사이트에는 확장 프로그램 상태를 공개하지 않는다', () => {
  const background = loadBackground();
  const result = background.listener()(
    { type: 'GET_CONNECTION_STATUS' },
    { url: 'https://example.com/' },
    () => assert.fail('untrusted website received a response'),
  );

  assert.equal(result, undefined);
});

test('온라인 풀이 저장 응답의 문제 메모 설정을 콘텐츠 스크립트까지 전달한다', async () => {
  const background = loadBackground({
    token: 'secret-extension-token',
    fetchResponse: {
      ok: true,
      status: 201,
      json: async () => ({
        duplicate: false,
        memoPrompt: { enabled: true, memo: { algorithmTags: '그래프' } },
      }),
    },
  });

  const result = await vm.runInContext("record({ problemId: '12948' })", background.context);
  assert.equal(result.ok, true);
  assert.equal(result.queued, false);
  assert.equal(result.memoPrompt.enabled, true);
  assert.equal(result.memoPrompt.memo.algorithmTags, '그래프');
});

test('오프라인 풀이 저장은 대기열에만 남고 문제 메모 설정을 전달하지 않는다', async () => {
  const background = loadBackground({ token: 'secret-extension-token' });
  const result = await vm.runInContext("record({ problemId: '12948' })", background.context);

  assert.equal(result.ok, true);
  assert.equal(result.queued, true);
  assert.equal(result.memoPrompt, undefined);
});

test('오프라인 문제 메모 저장은 별도 대기열에 보관하지 않는다', async () => {
  const background = loadBackground({ token: 'secret-extension-token' });
  const result = await vm.runInContext("saveProblemMemo({ problemId: '12948', approach: '풀이' })", background.context);

  assert.equal(result.ok, false);
  assert.equal(background.stored['pending-events'], undefined);
});

test('문제 메모는 입력 가능한 확장 프로그램 팝업 창으로 연다', async () => {
  const background = loadBackground();
  const result = await vm.runInContext(`openProblemMemoWindow({
    problem: { problemId: '12948', title: '핸드폰 번호 가리기' },
    memo: { algorithmTags: '문자열' }
  })`, background.context);

  assert.equal(result.ok, true);
  assert.equal(background.createdWindows.length, 1);
  assert.equal(background.createdWindows[0].type, 'popup');
  assert.equal(background.createdWindows[0].width, 760);
  assert.equal(background.createdWindows[0].height, 880);
  const promptKey = Object.keys(background.sessionStored).find((key) => key.startsWith('problem-memo-prompt:'));
  assert.equal(background.sessionStored[promptKey].problem.problemId, '12948');
  assert.equal(background.sessionStored[promptKey].memo.algorithmTags, '문자열');
});
