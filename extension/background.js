import { API_BASE } from './config.js';

const QUEUE_KEY = 'pending-events';
const SYNC_STATE_KEY = 'sync-state';
const INSTALLATION_KEY = 'installation-id';
const CONNECTION_KEY = 'connection';
const RETRY_ALARM = 'retry-pending-events';
const RETRY_INTERVAL_MINUTES = 1;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [60_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000];

let queueLock = Promise.resolve();
let flushChain = Promise.resolve();
let connectionPromise = null;

class SyncRequestError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'SyncRequestError';
    this.status = status;
  }
}

function withQueueLock(operation) {
  const result = queueLock.then(operation, operation);
  queueLock = result.catch(() => {});
  return result;
}

function eventId(event) {
  return `programmers:${String(event.problemId)}`;
}

function normalizeQueueItem(value) {
  const event = value?.event || value;
  if (!event?.problemId) return null;

  return {
    id: value?.id || eventId(event),
    event,
    queuedAt: value?.queuedAt || new Date().toISOString(),
    attempts: Number.isInteger(value?.attempts) ? value.attempts : 0,
    nextAttemptAt: Number.isFinite(value?.nextAttemptAt) ? value.nextAttemptAt : 0,
    status: ['pending', 'auth-required', 'rejected'].includes(value?.status) ? value.status : 'pending',
    lastError: value?.lastError || null,
  };
}

function normalizeQueue(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeQueueItem).filter(Boolean);
}

async function readQueue() {
  return withQueueLock(async () => {
    const data = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
    return normalizeQueue(data[QUEUE_KEY]);
  });
}

async function enqueue(event) {
  return withQueueLock(async () => {
    const data = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
    const queue = normalizeQueue(data[QUEUE_KEY]);
    const id = eventId(event);
    const existingIndex = queue.findIndex((item) => item.id === id);
    const existing = existingIndex === -1 ? null : queue[existingIndex];
    const item = {
      id,
      event,
      queuedAt: existing?.queuedAt || new Date().toISOString(),
      attempts: 0,
      nextAttemptAt: 0,
      status: 'pending',
      lastError: null,
    };

    if (existingIndex === -1) queue.push(item);
    else queue[existingIndex] = item;

    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
    return item;
  });
}

async function updateQueueItem(id, update) {
  return withQueueLock(async () => {
    const data = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
    const queue = normalizeQueue(data[QUEUE_KEY]);
    const index = queue.findIndex((item) => item.id === id);
    if (index === -1) return null;

    queue[index] = { ...queue[index], ...update };
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
    return queue[index];
  });
}

async function removeQueueItem(id) {
  return withQueueLock(async () => {
    const data = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
    const queue = normalizeQueue(data[QUEUE_KEY]);
    const nextQueue = queue.filter((item) => item.id !== id);
    if (nextQueue.length !== queue.length) {
      await chrome.storage.local.set({ [QUEUE_KEY]: nextQueue });
    }
  });
}

async function updateSyncState(update) {
  return withQueueLock(async () => {
    const data = await chrome.storage.local.get({ [SYNC_STATE_KEY]: {} });
    const state = { ...data[SYNC_STATE_KEY], ...update };
    await chrome.storage.local.set({ [SYNC_STATE_KEY]: state });
    return state;
  });
}

async function settings() {
  return chrome.storage.local.get({ token: '' });
}

function randomBase64Url(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  let binary = '';
  new Uint8Array(digest).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getInstallationId() {
  const data = await chrome.storage.local.get({ [INSTALLATION_KEY]: '' });
  if (data[INSTALLATION_KEY]) return data[INSTALLATION_KEY];
  const installationId = crypto.randomUUID();
  await chrome.storage.local.set({ [INSTALLATION_KEY]: installationId });
  return installationId;
}

function getDeviceName() {
  const userAgent = navigator.userAgent;
  const platform = /Windows/i.test(userAgent)
    ? 'Windows PC'
    : /Macintosh|Mac OS X/i.test(userAgent)
      ? 'Mac'
      : /CrOS/i.test(userAgent)
        ? 'Chromebook'
        : /Linux/i.test(userAgent)
          ? 'Linux PC'
          : 'Chrome 기기';
  return `${platform} · Chrome`;
}

async function performConnectAccount() {
  const installationId = await getInstallationId();
  const deviceName = getDeviceName();
  const redirectUri = chrome.identity.getRedirectURL('solvesync');
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const connectUrl = new URL(`${API_BASE.replace(/\/$/, '')}/extension/connect`);
  connectUrl.searchParams.set('installationId', installationId);
  connectUrl.searchParams.set('deviceName', deviceName);
  connectUrl.searchParams.set('redirectUri', redirectUri);
  connectUrl.searchParams.set('state', state);
  connectUrl.searchParams.set('codeChallenge', codeChallenge);

  const finalUrl = await chrome.identity.launchWebAuthFlow({ url: connectUrl.toString(), interactive: true });
  if (!finalUrl) throw new Error('연결 승인이 완료되지 않았습니다.');

  const callback = new URL(finalUrl);
  if (callback.origin !== new URL(redirectUri).origin || callback.searchParams.get('state') !== state) {
    throw new Error('연결 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
  }
  if (callback.searchParams.get('error') === 'access_denied') throw new Error('기기 연결을 취소했습니다.');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('연결 코드가 전달되지 않았습니다.');

  const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/extension/connect/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier, installationId }),
  });
  const result = await parseResponse(response);
  if (!response.ok || !result.token) throw new Error(result.error || '기기 연결을 완료하지 못했습니다.');

  const connection = {
    installationId: result.installationId || installationId,
    deviceName: result.deviceName || deviceName,
    connectedAt: result.connectedAt || new Date().toISOString(),
  };
  await chrome.storage.local.set({ token: result.token, [CONNECTION_KEY]: connection });
  await updateSyncState({ authRequired: false, lastError: null });
  const syncStatus = await flush({ force: true });
  return { ok: true, ...syncStatus, connection };
}

function connectAccount() {
  if (!connectionPromise) {
    connectionPromise = performConnectAccount().finally(() => { connectionPromise = null; });
  }
  return connectionPromise;
}

async function disconnectAccount() {
  const data = await chrome.storage.local.get({ token: '' });
  if (data.token) {
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/extension/connect/current`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${data.token}` },
    });
    const result = await parseResponse(response);
    if (!response.ok && response.status !== 401) throw new Error(result.error || '기기 연결을 해제하지 못했습니다.');
  }

  await chrome.storage.local.remove(['token', CONNECTION_KEY]);
  await updateSyncState({ authRequired: false, lastError: null });
  return { ok: true, ...await getSyncStatus() };
}

async function getExternalConnectionStatus() {
  const data = await chrome.storage.local.get({ token: '', [CONNECTION_KEY]: null });
  if (!data.token) {
    return { installed: true, connected: false, authRequired: false, connection: data[CONNECTION_KEY] || null };
  }

  try {
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/extension/connect/current`, {
      headers: { authorization: `Bearer ${data.token}` },
    });
    const result = await parseResponse(response);
    if (response.status === 401) {
      await updateSyncState({ authRequired: true });
      return { installed: true, connected: false, authRequired: true, connection: data[CONNECTION_KEY] || null };
    }
    if (!response.ok) {
      return { installed: true, connected: false, unavailable: true, error: result.error || '연동 상태를 확인하지 못했습니다.' };
    }

    await updateSyncState({ authRequired: false });
    return {
      installed: true,
      connected: true,
      authRequired: false,
      accountId: result.accountId,
      connection: result.connection || data[CONNECTION_KEY] || null,
    };
  } catch (error) {
    return {
      installed: true,
      connected: false,
      unavailable: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function sendEvent(token, event) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/events/programmers/accepted`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    const result = await parseResponse(response);
    if (!response.ok) throw new SyncRequestError(result.error || '이벤트 전송에 실패했습니다.', response.status);
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new SyncRequestError('서버 응답 시간이 초과되었습니다.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function saveProblemMemo(input) {
  const { token } = await settings();
  if (!token) return { ok: false, authRequired: true, error: '연동 토큰이 필요합니다.' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/problem-memos/programmers`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const result = await parseResponse(response);
    if (!response.ok) {
      return {
        ok: false,
        authRequired: response.status === 401,
        error: result.error || '문제 메모를 저장하지 못했습니다.',
      };
    }
    return { ok: true, updatedAt: result.updatedAt };
  } catch (error) {
    return {
      ok: false,
      error: error?.name === 'AbortError'
        ? '서버 응답 시간이 초과되었습니다.'
        : error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function retryDelay(attempts) {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)];
}

async function markFailure(item, error) {
  const attempts = item.attempts + 1;
  const statusCode = Number(error?.status || 0);
  const authRequired = statusCode === 401 || statusCode === 403;
  const rejected = statusCode >= 400 && statusCode < 500 && !authRequired && statusCode !== 408 && statusCode !== 429;
  const message = error instanceof Error ? error.message : String(error);
  const status = authRequired ? 'auth-required' : rejected ? 'rejected' : 'pending';
  const nextAttemptAt = authRequired
    ? Date.now() + 30 * 60_000
    : rejected
      ? 0
      : Date.now() + retryDelay(attempts);

  await updateQueueItem(item.id, {
    attempts,
    status,
    nextAttemptAt,
    lastError: { message, statusCode, at: new Date().toISOString() },
  });
  await updateSyncState({
    lastAttemptAt: new Date().toISOString(),
    lastError: { message, statusCode, at: new Date().toISOString() },
    authRequired,
  });

  return { authRequired, rejected };
}

async function performFlush({ force = false, onlyId = null } = {}) {
  const queue = await readQueue();
  const now = Date.now();
  const eligible = queue.filter((item) => {
    if (onlyId && item.id !== onlyId) return false;
    if (item.status === 'rejected') return false;
    return force || item.nextAttemptAt <= now;
  });
  if (!eligible.length) return { outcomes: {}, ...await getSyncStatus() };

  const { token } = await settings();
  const outcomes = {};
  if (!token) {
    for (const item of eligible) {
      const error = new SyncRequestError('연동 토큰이 필요합니다.', 401);
      await markFailure(item, error);
      outcomes[item.id] = { ok: false, queued: true, authRequired: true, error: error.message };
    }
    return { outcomes, ...await getSyncStatus() };
  }

  for (let index = 0; index < eligible.length; index += 1) {
    const item = eligible[index];
    try {
      await updateSyncState({ lastAttemptAt: new Date().toISOString() });
      const result = await sendEvent(token, item.event);
      // The server is idempotent. A duplicate response is also a completed delivery.
      await removeQueueItem(item.id);
      await updateSyncState({
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        authRequired: false,
      });
      outcomes[item.id] = {
        ok: true,
        queued: false,
        duplicate: Boolean(result.duplicate),
        memoPrompt: result.memoPrompt || { enabled: false, memo: null },
      };
    } catch (error) {
      const failure = await markFailure(item, error);
      outcomes[item.id] = {
        ok: false,
        queued: true,
        authRequired: failure.authRequired,
        rejected: failure.rejected,
        error: error instanceof Error ? error.message : String(error),
      };

      // Network/server/auth failures will affect the remaining items too. Retry them later.
      if (failure.authRequired) {
        for (const remaining of eligible.slice(index + 1)) {
          await markFailure(remaining, error);
          outcomes[remaining.id] = {
            ok: false,
            queued: true,
            authRequired: true,
            rejected: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
      if (!failure.rejected) break;
    }
  }

  return { outcomes, ...await getSyncStatus() };
}

function flush(options) {
  const result = flushChain.then(() => performFlush(options));
  flushChain = result.catch(() => {});
  return result;
}

async function record(event) {
  let item;
  try {
    // Persist first. From this point, a worker/browser shutdown can only cause a duplicate retry.
    item = await enqueue(event);
  } catch (error) {
    return { ok: false, queued: false, error: `풀이 기록을 로컬에 보관하지 못했습니다: ${error.message}` };
  }

  try {
    const result = await flush({ force: true, onlyId: item.id });
    const outcome = result.outcomes[item.id];
    if (outcome?.ok) return { ...outcome, pendingCount: result.pendingCount };

    // Safely queued is considered accepted by the content script; alarms handle delivery later.
    return {
      ok: true,
      queued: true,
      pendingCount: result.pendingCount,
      authRequired: Boolean(outcome?.authRequired),
      error: outcome?.error || result.lastError?.message || null,
    };
  } catch (error) {
    return {
      ok: true,
      queued: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getSyncStatus() {
  const [queue, data] = await Promise.all([
    readQueue(),
    chrome.storage.local.get({ token: '', [SYNC_STATE_KEY]: {}, [CONNECTION_KEY]: null }),
  ]);
  const state = data[SYNC_STATE_KEY] || {};
  return {
    connected: Boolean(data.token),
    connection: data[CONNECTION_KEY] || null,
    pendingCount: queue.filter((item) => item.status !== 'rejected').length,
    rejectedCount: queue.filter((item) => item.status === 'rejected').length,
    authRequired: queue.some((item) => item.status === 'auth-required') || Boolean(state.authRequired),
    lastSuccessAt: state.lastSuccessAt || null,
    lastAttemptAt: state.lastAttemptAt || null,
    lastError: state.lastError || null,
  };
}

async function ensureRetryAlarm() {
  const alarm = await chrome.alarms.get(RETRY_ALARM);
  if (!alarm) {
    await chrome.alarms.create(RETRY_ALARM, { periodInMinutes: RETRY_INTERVAL_MINUTES });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'PROGRAMMERS_ACCEPTED') {
    record(message.event).then(respond).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_SYNC_STATUS') {
    getSyncStatus().then(respond).catch((error) => respond({ error: error.message }));
    return true;
  }

  if (message.type === 'SAVE_PROBLEM_MEMO') {
    saveProblemMemo(message.memo).then(respond).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'FLUSH_PENDING_EVENTS') {
    flush({ force: true }).then(respond).catch((error) => respond({ error: error.message }));
    return true;
  }

  if (message.type === 'CONNECT_ACCOUNT') {
    connectAccount().then(respond).catch((error) => respond({ error: error.message }));
    return true;
  }

  if (message.type === 'DISCONNECT_ACCOUNT') {
    disconnectAccount().then(respond).catch((error) => respond({ error: error.message }));
    return true;
  }

  if (message.type === 'TOKEN_UPDATED') {
    updateSyncState({ authRequired: false, lastError: null })
      .then(() => flush({ force: true }))
      .then(respond)
      .catch((error) => respond({ error: error.message }));
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  let trustedOrigin = false;
  try {
    trustedOrigin = Boolean(sender.url) && new URL(sender.url).origin === new URL(API_BASE).origin;
  } catch {
    trustedOrigin = false;
  }
  if (!trustedOrigin || message?.type !== 'GET_CONNECTION_STATUS') return;

  getExternalConnectionStatus()
    .then(respond)
    .catch((error) => respond({ installed: true, connected: false, unavailable: true, error: error instanceof Error ? error.message : String(error) }));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM) void flush();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureRetryAlarm();
  void flush({ force: true });
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureRetryAlarm();
  void flush({ force: true });
});

void ensureRetryAlarm();
