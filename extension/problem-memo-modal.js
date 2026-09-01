(() => {
  const ROOT_ID = 'solvesync-problem-memo-root';

  const fields = [
    { key: 'algorithmTags', label: '알고리즘 테마', maxLength: 300, placeholder: '예: 그리디, 정렬, 투 포인터', rows: 1 },
    { key: 'approach', label: '접근 방법', maxLength: 500, placeholder: '문제를 보고 떠올린 핵심 아이디어와 풀이 순서를 적어보세요.', rows: 4 },
    { key: 'solutionCode', label: '해결 코드', maxLength: 10000, placeholder: '최종 해결 코드를 붙여 넣어보세요.', rows: 9, code: true },
    { key: 'difficultyReason', label: '틀리거나 시간이 오래 걸린 이유', maxLength: 500, placeholder: '막혔던 지점, 잘못 생각한 부분과 오래 걸린 이유를 적어보세요.', rows: 4 },
    { key: 'learnings', label: '배운 점', maxLength: 300, placeholder: '이 문제를 통해 새로 알게 된 점이나 다음에 기억할 내용을 적어보세요.', rows: 4 },
  ];

  function fieldMarkup(field) {
    const control = field.rows === 1
      ? `<input id="solvesync-${field.key}" name="${field.key}" maxlength="${field.maxLength}" placeholder="${field.placeholder}">`
      : `<textarea id="solvesync-${field.key}" name="${field.key}" rows="${field.rows}" maxlength="${field.maxLength}" placeholder="${field.placeholder}"${field.code ? ' class="code" spellcheck="false"' : ''}></textarea>`;
    return `
      <div class="field">
        <div class="field-heading">
          <label for="solvesync-${field.key}">${field.label}</label>
          <span class="counter" data-counter="${field.key}">0/${field.maxLength}</span>
        </div>
        ${control}
      </div>`;
  }

  function open({ problem, memo, onSave }) {
    document.getElementById(ROOT_ID)?.remove();

    const host = document.createElement('div');
    host.id = ROOT_ID;
    document.documentElement.append(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; color-scheme: light; }
      *, *::before, *::after { box-sizing: border-box; }
      .backdrop {
        position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
        padding: 24px; background: rgba(15, 23, 42, .58); font-family: -apple-system, BlinkMacSystemFont,
        "Segoe UI", "Noto Sans KR", sans-serif; color: #17201b;
      }
      .dialog {
        display: flex; width: min(720px, 100%); max-height: min(880px, calc(100vh - 48px));
        flex-direction: column; overflow: hidden; border: 1px solid rgba(15, 23, 42, .1);
        border-radius: 24px; background: #fff; box-shadow: 0 30px 90px rgba(15, 23, 42, .3);
      }
      .header { display: flex; align-items: flex-start; gap: 18px; padding: 24px 26px 18px; border-bottom: 1px solid #e8edea; }
      .header-copy { min-width: 0; flex: 1; }
      .eyebrow { margin: 0 0 6px; color: #138a58; font-size: 12px; font-weight: 750; letter-spacing: .02em; }
      h2 { margin: 0; overflow: hidden; font-size: 21px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
      .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .badge { border-radius: 999px; background: #eef7f2; padding: 5px 9px; color: #426052; font-size: 11px; font-weight: 650; }
      .close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; border: 0; border-radius: 10px; background: transparent; color: #64736b; cursor: pointer; font-size: 25px; line-height: 1; }
      .close:hover { background: #f1f5f3; color: #17201b; }
      form { display: contents; }
      .body { min-height: 0; overflow-y: auto; padding: 4px 26px 8px; }
      .intro { margin: 16px 0 2px; color: #64736b; font-size: 13px; line-height: 1.6; }
      .field { padding: 18px 0; border-bottom: 1px solid #edf0ee; }
      .field:last-child { border-bottom: 0; }
      .field-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
      label { color: #17201b; font-size: 13px; font-weight: 750; }
      .counter { color: #849089; font-size: 10px; font-variant-numeric: tabular-nums; }
      input, textarea {
        display: block; width: 100%; border: 1px solid #dce3df; border-radius: 12px; outline: none;
        background: #f8faf9; padding: 11px 13px; color: #17201b; font: 13px/1.65 -apple-system,
        BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif; resize: vertical;
      }
      input { height: 44px; resize: none; }
      input:focus, textarea:focus { border-color: #52ae81; box-shadow: 0 0 0 3px rgba(46, 158, 101, .12); background: #fff; }
      input::placeholder, textarea::placeholder { color: #9aa49f; }
      textarea.code { min-height: 210px; tab-size: 2; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
      .footer { display: flex; align-items: center; gap: 16px; padding: 16px 26px 20px; border-top: 1px solid #e8edea; background: #fbfcfb; }
      .status { min-width: 0; flex: 1; margin: 0; color: #64736b; font-size: 12px; line-height: 1.45; }
      .status.error { color: #c53b3b; }
      .actions { display: flex; flex: none; gap: 9px; }
      .button { min-height: 42px; border-radius: 12px; padding: 0 17px; font: 700 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif; cursor: pointer; }
      .button:disabled { cursor: wait; opacity: .6; }
      .cancel { border: 1px solid #d7dfdb; background: #fff; color: #526159; }
      .save { border: 1px solid #1b9a62; background: #1b9a62; color: #fff; box-shadow: 0 6px 14px rgba(27, 154, 98, .2); }
      .save:hover:not(:disabled) { background: #138a58; }
      @media (max-width: 640px) {
        .backdrop { align-items: end; padding: 0; }
        .dialog { max-height: 92vh; border-radius: 22px 22px 0 0; }
        .header { padding: 20px 18px 15px; }
        .body { padding: 2px 18px 6px; }
        .footer { align-items: stretch; flex-direction: column; padding: 13px 18px max(16px, env(safe-area-inset-bottom)); }
        .actions { display: grid; grid-template-columns: 1fr 1.4fr; }
        .button { width: 100%; }
      }
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    backdrop.innerHTML = `
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="solvesync-memo-title" aria-describedby="solvesync-memo-description">
        <div class="header">
          <div class="header-copy">
            <p class="eyebrow">SolveSync 문제 메모</p>
            <h2 id="solvesync-memo-title"></h2>
            <div class="meta"></div>
          </div>
          <button class="close" type="button" aria-label="문제 메모 닫기">×</button>
        </div>
        <form>
          <div class="body">
            <p class="intro" id="solvesync-memo-description">방금 해결한 문제에서 다시 볼 핵심 내용을 남겨보세요.</p>
            ${fields.map(fieldMarkup).join('')}
          </div>
          <div class="footer">
            <p class="status" aria-live="polite">저장하면 SolveSync 문제 메모에서 언제든 다시 볼 수 있습니다.</p>
            <div class="actions">
              <button class="button cancel" type="button">나중에</button>
              <button class="button save" type="submit">저장하기</button>
            </div>
          </div>
        </form>
      </section>`;
    shadow.append(style, backdrop);

    const form = backdrop.querySelector('form');
    const title = backdrop.querySelector('h2');
    const meta = backdrop.querySelector('.meta');
    const status = backdrop.querySelector('.status');
    const saveButton = backdrop.querySelector('.save');
    const closeButton = backdrop.querySelector('.close');
    const cancelButton = backdrop.querySelector('.cancel');
    let saving = false;

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
      const counter = backdrop.querySelector(`[data-counter="${field.key}"]`);
      control.value = typeof memo?.[field.key] === 'string' ? memo[field.key] : '';
      const updateCounter = () => { counter.textContent = `${control.value.length}/${field.maxLength}`; };
      control.addEventListener('input', updateCounter);
      updateCounter();
    }

    const close = () => {
      if (saving) return;
      document.removeEventListener('keydown', onKeyDown, true);
      host.remove();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    closeButton.addEventListener('click', close);
    cancelButton.addEventListener('click', close);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (saving) return;
      saving = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      closeButton.disabled = true;
      saveButton.textContent = '저장 중...';
      status.classList.remove('error');
      status.textContent = '문제 메모를 저장하고 있습니다.';

      const draft = Object.fromEntries(fields.map((field) => [field.key, form.elements.namedItem(field.key).value]));
      try {
        const result = await onSave(draft);
        if (!result?.ok) {
          status.classList.add('error');
          status.textContent = result?.error || '문제 메모를 저장하지 못했습니다.';
          return;
        }
        status.textContent = '문제 메모를 저장했습니다.';
        saveButton.textContent = '저장 완료';
        window.setTimeout(() => {
          saving = false;
          close();
        }, 550);
      } catch (error) {
        status.classList.add('error');
        status.textContent = error instanceof Error ? error.message : '문제 메모를 저장하지 못했습니다.';
      } finally {
        if (host.isConnected && saveButton.textContent !== '저장 완료') {
          saving = false;
          saveButton.disabled = false;
          cancelButton.disabled = false;
          closeButton.disabled = false;
          saveButton.textContent = '다시 저장';
        }
      }
    });

    window.requestAnimationFrame(() => form.elements.namedItem('algorithmTags')?.focus());
  }

  globalThis.SolveSyncProblemMemoModal = { open };
})();
