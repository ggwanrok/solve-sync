const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const backgroundScript = readFileSync(new URL('../extension/background.js', `file://${__filename}`), 'utf8')
  .replace("import { API_BASE } from './config.js';", "const API_BASE = 'https://solve-sync.vercel.app';");

function loadBackground({ token = '', connection = null, fetchResponse } = {}) {
  const stored = { token, connection, 'sync-state': {} };
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
      },
    },
  });
  vm.runInContext(backgroundScript, context);
  return { listener: () => externalListener, fetchCount: () => fetchCount };
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
