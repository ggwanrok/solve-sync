const fields = [
  { key: 'algorithmTags', maxLength: 300 },
  { key: 'approach', maxLength: 500 },
  { key: 'solutionCode', maxLength: 10000 },
  { key: 'difficultyReason', maxLength: 500 },
  { key: 'learnings', maxLength: 300 },
];

const form = document.querySelector('#memoForm');
const title = document.querySelector('#problemTitle');
const meta = document.querySelector('#problemMeta');
const status = document.querySelector('#status');
const saveButton = document.querySelector('#saveButton');
const cancelButton = document.querySelector('#cancelButton');
const promptId = new URLSearchParams(location.search).get('prompt') || '';
const storageKey = `problem-memo-prompt:${promptId}`;
let problem = null;

function setUnavailable(message) {
  status.classList.add('error');
  status.textContent = message;
  saveButton.disabled = true;
  for (const field of fields) form.elements.namedItem(field.key).disabled = true;
}

function render(payload) {
  problem = payload.problem;
  const memo = payload.memo || {};
  title.textContent = problem.title || `문제 ${problem.problemId}`;
  [problem.language, problem.problemType === 'sql' ? 'SQL' : '알고리즘', problem.difficulty == null ? null : `Lv. ${problem.difficulty}`]
    .filter(Boolean)
    .forEach((value) => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = value;
      meta.append(badge);
    });

  for (const field of fields) {
    const control = form.elements.namedItem(field.key);
    const counter = document.querySelector(`[data-counter="${field.key}"]`);
    control.value = typeof memo[field.key] === 'string' ? memo[field.key] : '';
    const updateCounter = () => { counter.textContent = `${control.value.length}/${field.maxLength}`; };
    control.addEventListener('input', updateCounter);
    updateCounter();
  }
  form.elements.namedItem('algorithmTags').focus();
}

async function load() {
  if (!promptId) return setUnavailable('문제 메모 정보를 찾지 못했습니다. 창을 닫고 다시 시도해 주세요.');
  try {
    const stored = await chrome.storage.session.get(storageKey);
    const payload = stored[storageKey];
    if (!payload?.problem?.problemId) return setUnavailable('문제 메모 정보가 만료되었습니다. 창을 닫고 다시 시도해 주세요.');
    render(payload);
  } catch {
    setUnavailable('문제 메모 정보를 불러오지 못했습니다.');
  }
}

cancelButton.addEventListener('click', () => window.close());
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!problem || saveButton.disabled) return;

  saveButton.disabled = true;
  cancelButton.disabled = true;
  saveButton.textContent = '저장 중...';
  status.classList.remove('error');
  status.textContent = '문제 메모를 저장하고 있습니다.';

  const draft = Object.fromEntries(fields.map((field) => [field.key, form.elements.namedItem(field.key).value]));
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'SAVE_PROBLEM_MEMO',
      memo: { problemId: problem.problemId, ...draft },
    });
    if (!result?.ok) {
      status.classList.add('error');
      status.textContent = result?.error || '문제 메모를 저장하지 못했습니다.';
      return;
    }
    status.textContent = '문제 메모를 저장했습니다.';
    saveButton.textContent = '저장 완료';
    window.setTimeout(() => window.close(), 550);
  } catch (error) {
    status.classList.add('error');
    status.textContent = error instanceof Error ? error.message : '문제 메모를 저장하지 못했습니다.';
  } finally {
    if (saveButton.textContent !== '저장 완료') {
      saveButton.disabled = false;
      cancelButton.disabled = false;
      saveButton.textContent = '다시 저장';
    }
  }
});

void load();
