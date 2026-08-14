import { API_BASE } from './config.js';

const output = document.querySelector('output');
const syncStatus = document.querySelector('#syncStatus');
const deviceName = document.querySelector('#deviceName');
const connectAccount = document.querySelector('#connectAccount');
const syncNow = document.querySelector('#syncNow');
const disconnectAccount = document.querySelector('#disconnectAccount');

function statusText(status) {
  if (!status.connected) return '연결된 계정이 없습니다.';
  if (status.authRequired) return `재연결이 필요합니다. 대기 중인 기록 ${status.pendingCount}건`;
  if (status.rejectedCount) return `동기화 대기 ${status.pendingCount}건 · 확인 필요 ${status.rejectedCount}건`;
  if (status.pendingCount) return `동기화 대기 중인 기록 ${status.pendingCount}건`;
  return '연동됨 · 모든 풀이 기록이 동기화되었습니다.';
}

async function refreshStatus() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
  syncStatus.textContent = status.error ? `상태 확인 실패: ${status.error}` : statusText(status);
  deviceName.textContent = status.connection?.deviceName ? `연결 기기 · ${status.connection.deviceName}` : '';
  connectAccount.textContent = status.authRequired ? 'SolveSync 계정 다시 연결' : 'SolveSync 계정 연결';
  connectAccount.hidden = status.connected && !status.authRequired;
  syncNow.disabled = !status.connected || !status.pendingCount;
  disconnectAccount.hidden = !status.connected;
  return status;
}

connectAccount.addEventListener('click', async () => {
  connectAccount.disabled = true;
  output.textContent = '로그인 및 기기 승인 화면을 여는 중입니다.';
  const origin = new URL(API_BASE).origin + '/*';
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    output.textContent = '서버 통신 권한을 허용해 주세요.';
    connectAccount.disabled = false;
    return;
  }
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CONNECT_ACCOUNT' });
    if (result.error) throw new Error(result.error);
    output.textContent = result.pendingCount
      ? `계정 연결 완료. 보관 기록 ${result.pendingCount}건은 자동으로 다시 시도합니다.`
      : '계정 연결 완료. 모든 풀이 기록이 동기화되었습니다.';
  } catch (error) {
    output.textContent = `연결 실패: ${error.message}`;
  } finally {
    connectAccount.disabled = false;
    await refreshStatus();
  }
});

syncNow.addEventListener('click', async () => {
  syncNow.disabled = true;
  output.textContent = '보관된 풀이 기록을 동기화하는 중입니다.';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'FLUSH_PENDING_EVENTS' });
    if (result.error) throw new Error(result.error);
    output.textContent = result.pendingCount ? `${result.pendingCount}건은 자동으로 다시 시도합니다.` : '모든 풀이 기록이 동기화되었습니다.';
  } catch (error) {
    output.textContent = `동기화 실패: ${error.message}`;
  } finally {
    await refreshStatus();
  }
});

disconnectAccount.addEventListener('click', async () => {
  if (!confirm('이 기기의 SolveSync 연결을 해제할까요? 보관 중인 풀이 기록은 삭제되지 않습니다.')) return;
  disconnectAccount.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'DISCONNECT_ACCOUNT' });
    if (result.error) throw new Error(result.error);
    output.textContent = '이 기기의 연결을 해제했습니다.';
  } catch (error) {
    output.textContent = `연결 해제 실패: ${error.message}`;
  } finally {
    disconnectAccount.disabled = false;
    await refreshStatus();
  }
});

refreshStatus().catch((error) => {
  syncStatus.textContent = `상태 확인 실패: ${error.message}`;
});
