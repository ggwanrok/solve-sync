// 프로그래머스의 UI는 변경될 수 있습니다. 성공 문구/메타데이터 추출은 이 파일에서만 보정합니다.
const SUCCESS_TEXT = /(?:^|\s)정답(?:입니다|이에요|\s*처리|[!！]|\s*$)|테스트를\s*통과|채점\s*결과[^\n]{0,30}통과|모든\s*테스트.*통과|제출이\s*성공/;
const FAILURE_TEXT = /실패|오답|런타임\s*에러|컴파일\s*에러|시간\s*초과/;
let sentForProblem = new Set();

function problemId() {
  return location.pathname.match(/\/lessons\/(\d+)/)?.[1] || location.pathname.match(/\/challenges\/(\d+)/)?.[1] || null;
}
function text(node = document.body) { return node?.innerText?.replace(/\s+/g, ' ').trim() || ''; }
function normalizedProblemTitle(value = '') {
  return value
    .replace(/\s*\|\s*프로그래머스(?:\s*스쿨)?\s*$/, '')
    .replace(/^코딩테스트\s*연습\s*-\s*/, '')
    .trim();
}
function title() {
  const score = /^\d[\d,]*(?:\.\d+)?\s*\(\s*[+-]\d+\s*\)$/;
  const breadcrumb = text(document.querySelector('.breadcrumb li.active, .breadcrumb .active'));
  if (breadcrumb && !score.test(breadcrumb)) return breadcrumb;

  const metadata = document.querySelector('meta[property="og:title"]')?.content || document.title;
  const metadataTitle = normalizedProblemTitle(metadata);
  if (metadataTitle && !score.test(metadataTitle) && !/^(?:코딩테스트\s*연습|연습문제)$/.test(metadataTitle)) return metadataTitle;

  const headings = [...document.querySelectorAll('h1,h2')].map((node) => text(node)).filter(Boolean);
  return headings.find((item) => !score.test(item) && !/코딩테스트|연습문제|제출|실행/.test(item)) || `문제 ${problemId()}`;
}
function language() {
  const selected = document.querySelector('.dropdown-language .dropdown-toggle, .dropdown-language [data-toggle="dropdown"], [aria-selected="true"], .language-selector .selected, select');
  return selected?.value || text(selected) || null;
}
function problemType(selectedLanguage) {
  const normalized = String(selectedLanguage ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ['mariadb', 'microsoft sql server', 'mssql', 'mysql', 'oracle', 'postgres', 'postgresql', 'sql', 'sql server', 'sqlite'].includes(normalized)
    ? 'sql'
    : 'algorithm';
}
function normalizedDifficulty(value) {
  const match = String(value ?? '').trim().match(/^(?:Lv\.?\s*)?([0-5])$/i);
  return match ? Number(match[1]) : null;
}
function difficulty() {
  const id = problemId();
  const candidates = [...document.querySelectorAll('[data-challenge-level]')];
  const metadata = candidates.find((node) => node.dataset.lessonId === id)
    || candidates.find((node) => !node.dataset.lessonId)
    || candidates[0];
  return normalizedDifficulty(metadata?.dataset?.challengeLevel);
}
function resultElement() {
  const modalResult = document.querySelector('div.modal-header > h4, #modal-dialog h4, .modal-header h4, [class*="modal" i] h4');
  if (modalResult && SUCCESS_TEXT.test(text(modalResult)) && !FAILURE_TEXT.test(text(modalResult))) return modalResult;
  return [...document.querySelectorAll('[role="dialog"], [class*="result" i], [class*="submit" i], [class*="toast" i], main')]
    .find((node) => SUCCESS_TEXT.test(text(node)) && !FAILURE_TEXT.test(text(node)));
}
function solvedResultInSubmitModal() {
  const selectors = 'div.modal-header > h4, #modal-dialog h4, .modal-header h4, [class*="modal" i] h4';
  return [...document.querySelectorAll(selectors)].some((node) => text(node).includes('정답'));
}
function eventFor(id) {
  const startKey = `algosync:programmers:started:${id}`;
  const startedAt = sessionStorage.getItem(startKey) || new Date().toISOString();
  const acceptedAt = new Date().toISOString();
  const selectedLanguage = language();
  return { startKey, event: { problemId: id, title: title(), url: location.origin + location.pathname, language: selectedLanguage, problemType: problemType(selectedLanguage), difficulty: difficulty(), startedAt, acceptedAt, durationSeconds: Math.max(0, Math.round((Date.parse(acceptedAt) - Date.parse(startedAt)) / 1000)) } };
}
async function openProblemMemoWindow(event, response) {
  // 오프라인 큐 적재나 지연 재전송에서는 메모 창을 열지 않습니다.
  if (response.queued || !response.memoPrompt?.enabled) return;
  const result = await chrome.runtime.sendMessage({
    type: 'OPEN_PROBLEM_MEMO_WINDOW',
    prompt: { problem: event, memo: response.memoPrompt.memo },
  });
  if (!result?.ok) console.info('[SolveSync] 문제 메모 창을 열지 못했습니다:', result?.error);
}
async function capture(requireSuccess = true) {
  const id = problemId(); const result = resultElement();
  if (!id) return { ok: false, error: '프로그래머스 연습문제 페이지를 찾지 못했습니다.' };
  if (requireSuccess && !result) return { ok: false, error: '현재 화면에서 “정답입니다.” 결과를 찾지 못했습니다. 제출 결과 모달을 연 상태에서 다시 시도해 주세요.' };
  if (sentForProblem.has(id)) return { ok: true, duplicate: true };
  sentForProblem.add(id);
  const { startKey, event } = eventFor(id);
  try {
    const response = await chrome.runtime.sendMessage({ type: 'PROGRAMMERS_ACCEPTED', event });
    if (!response?.ok) {
      console.info('[SolveSync] 풀이 기록을 보관하지 못했습니다:', response?.error);
      sentForProblem.delete(id);
      return response || { ok: false, error: '확장 프로그램 응답이 없습니다.' };
    }
    if (response.queued) console.info('[SolveSync] 풀이 기록을 로컬에 보관했으며 자동 재전송합니다.');
    await openProblemMemoWindow(event, response);
    sessionStorage.removeItem(startKey);
    return response;
  } catch (error) {
    console.info('[SolveSync] 확장 프로그램 연결에 실패했습니다:', error?.message);
    sentForProblem.delete(id);
    return { ok: false, error: error?.message || '확장 프로그램에 연결하지 못했습니다.' };
  }
}
async function detect() {
  // 프로그래머스의 제출 결과 모달은 SPA로 갱신됩니다. 백준허브와 같이 모달의 정답 상태를 직접 감지합니다.
  if (!solvedResultInSubmitModal()) return;
  await capture(false);
}
function rememberStart() { const id = problemId(); if (!id) return; const startKey = `algosync:programmers:started:${id}`; if (!sessionStorage.getItem(startKey)) sessionStorage.setItem(startKey, new Date().toISOString()); }
new MutationObserver(() => { detect(); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
rememberStart();
detect();
// 프로그래머스 제출 결과는 SPA 모달에서 갱신되므로 DOM 변이 외에 짧은 폴링도 둡니다.
setInterval(detect, 500);
