import { API_BASE } from './config.js';

const connectionStatus = document.querySelector('#connectionStatus');
const deviceName = document.querySelector('#deviceName');
const queueStatus = document.querySelector('#queueStatus');
const lastSync = document.querySelector('#lastSync');
const lastError = document.querySelector('#lastError');
const syncNow = document.querySelector('#syncNow');
const connectAccount = document.querySelector('#connectAccount');
const disconnectAccount = document.querySelector('#disconnectAccount');

function formatDate(value) {
  if (!value) return '아직 동기화 기록이 없습니다.';
  return `마지막 동기화 ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))}`;
}

function render(status) {
  if (status.authRequired) connectionStatus.textContent = '재연동이 필요합니다.';
  else if (status.connected) connectionStatus.textContent = '계정과 연동되어 있습니다.';
  else connectionStatus.textContent = '연동 토큰이 없습니다.';

  deviceName.textContent = status.connection?.deviceName || '';

  const queueParts = [`동기화 대기 ${status.pendingCount || 0}건`];
  if (status.rejectedCount) queueParts.push(`확인 필요 ${status.rejectedCount}건`);
  queueStatus.textContent = queueParts.join(' · ');
  lastSync.textContent = formatDate(status.lastSuccessAt);
  lastError.hidden = !status.lastError;
  lastError.textContent = status.lastError ? `최근 오류: ${status.lastError.message}` : '';
  syncNow.disabled = !status.connected || !status.pendingCount;
  connectAccount.hidden = status.connected && !status.authRequired;
  connectAccount.textContent = status.authRequired ? '계정 다시 연결' : 'SolveSync 계정 연결';
  disconnectAccount.hidden = !status.connected;
}

async function requestServerPermission() {
  const origin = new URL(API_BASE).origin + '/*';
  return chrome.permissions.request({ origins: [origin] });
}

connectAccount.addEventListener('click', async () => {
  connectAccount.disabled = true;
  connectAccount.textContent = '연결 화면 여는 중...';
  lastError.hidden = true;
  try {
    const granted = await requestServerPermission();
    if (!granted) throw new Error('SolveSync 서버 통신 권한을 허용해 주세요.');
    const status = await chrome.runtime.sendMessage({ type: 'CONNECT_ACCOUNT' });
    if (status.error) throw new Error(status.error);
    render(status);
  } catch (error) {
    await refresh().catch(() => {});
    lastError.hidden = false;
    lastError.textContent = error.message;
  } finally {
    connectAccount.disabled = false;
  }
});

disconnectAccount.addEventListener('click', async () => {
  if (!confirm('이 기기의 SolveSync 연결을 해제할까요? 보관 중인 풀이 기록은 삭제되지 않습니다.')) return;
  disconnectAccount.disabled = true;
  try {
    const status = await chrome.runtime.sendMessage({ type: 'DISCONNECT_ACCOUNT' });
    if (status.error) throw new Error(status.error);
    render(status);
  } catch (error) {
    lastError.hidden = false;
    lastError.textContent = error.message;
  } finally {
    disconnectAccount.disabled = false;
  }
});

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
  if (status.error) throw new Error(status.error);
  render(status);
}

syncNow.addEventListener('click', async () => {
  syncNow.disabled = true;
  syncNow.textContent = '동기화 중...';
  try {
    const status = await chrome.runtime.sendMessage({ type: 'FLUSH_PENDING_EVENTS' });
    if (status.error) throw new Error(status.error);
    render(status);
  } catch (error) {
    lastError.hidden = false;
    lastError.textContent = `동기화 실패: ${error.message}`;
  } finally {
    syncNow.textContent = '지금 동기화';
  }
});

refresh().catch((error) => {
  connectionStatus.textContent = '상태를 확인하지 못했습니다.';
  lastError.hidden = false;
  lastError.textContent = error.message;
  syncNow.disabled = true;
});
