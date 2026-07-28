import { API_BASE } from './config.js';

const form = document.querySelector('form'); const output = document.querySelector('output'); const apiBase = document.querySelector('#apiBase'); const token = document.querySelector('#token');
apiBase.value = API_BASE;
form.addEventListener('submit', async (event) => { event.preventDefault(); const savedToken = token.value.trim(); if (!savedToken) return output.textContent = '연동 토큰을 붙여 넣어 주세요.'; const origin = new URL(API_BASE).origin + '/*'; const granted = await chrome.permissions.request({ origins: [origin] }); if (!granted) return output.textContent = '서버 통신 권한을 허용해 주세요.'; await chrome.storage.local.set({ token: savedToken }); token.value = ''; output.textContent = '연동 완료. 이제 정답 제출을 자동으로 기록합니다.'; });
