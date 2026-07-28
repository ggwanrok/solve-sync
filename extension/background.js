import { API_BASE } from './config.js';

const QUEUE_KEY = 'pending-events';
const MAX_QUEUE_SIZE = 100;

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type !== 'PROGRAMMERS_ACCEPTED') return;
  record(message.event).then(respond).catch((error) => respond({ ok: false, error: error.message }));
  return true;
});

async function settings() { return chrome.storage.local.get({ token: '' }); }
async function queue(event) {
  const data = await chrome.storage.local.get({ [QUEUE_KEY]: [] });
  const withoutDuplicate = data[QUEUE_KEY].filter((item) => item.problemId !== event.problemId);
  await chrome.storage.local.set({ [QUEUE_KEY]: [...withoutDuplicate, event].slice(-MAX_QUEUE_SIZE) });
}
async function record(event) {
  const { token } = await settings();
  if (!token) return { ok: false, error: '확장 프로그램 옵션에서 연동 토큰을 입력해 주세요.' };
  try {
    const response = await fetch(`${API_BASE.replace(/\/$/, '')}/api/events/programmers/accepted`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(event) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '이벤트 전송에 실패했습니다.');
    return { ok: true, duplicate: result.duplicate };
  } catch (error) { await queue(event); return { ok: false, queued: true, error: error.message }; }
}
async function flush() { const data = await chrome.storage.local.get({ [QUEUE_KEY]: [] }); if (!data[QUEUE_KEY].length) return; await chrome.storage.local.set({ [QUEUE_KEY]: [] }); for (const event of data[QUEUE_KEY]) await record(event); }
chrome.runtime.onStartup.addListener(flush); chrome.runtime.onInstalled.addListener(flush);
