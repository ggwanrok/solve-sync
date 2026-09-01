const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const contentScript = readFileSync(new URL('../extension/content.js', `file://${__filename}`), 'utf8');

async function captureAttempt(challengeLevel, selectedLanguage = 'JavaScript', acceptedResponse = { ok: true }) {
  const session = new Map();
  const sentMessages = [];
  const difficultyNodes = challengeLevel == null
    ? []
    : [{ dataset: { challengeLevel, lessonId: '12948' } }];
  const context = vm.createContext({
    chrome: {
      runtime: {
        sendMessage: async (message) => {
          sentMessages.push(message);
          if (message.type === 'PROGRAMMERS_ACCEPTED') return acceptedResponse;
          if (message.type === 'OPEN_PROBLEM_MEMO_WINDOW') return { ok: true, windowId: 7 };
          return { ok: false };
        },
      },
    },
    console,
    confirm: () => true,
    Date,
    document: {
      body: { innerText: '' },
      documentElement: {},
      title: '코딩테스트 연습 - 핸드폰 번호 가리기 | 프로그래머스 스쿨',
      querySelector(selector) {
        if (selector === '.breadcrumb li.active, .breadcrumb .active') return { innerText: '핸드폰 번호 가리기' };
        if (selector.startsWith('.dropdown-language .dropdown-toggle')) return { innerText: selectedLanguage };
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '[data-challenge-level]') return difficultyNodes;
        return [];
      },
    },
    location: {
      origin: 'https://school.programmers.co.kr',
      pathname: '/learn/courses/30/lessons/12948',
    },
    MutationObserver: class {
      observe() {}
    },
    sessionStorage: {
      getItem: (key) => session.get(key) || null,
      setItem: (key, value) => session.set(key, value),
      removeItem: (key) => session.delete(key),
    },
    setInterval: () => 0,
  });

  vm.runInContext(contentScript, context);
  await vm.runInContext('capture(false)', context);
  const acceptedMessage = sentMessages.find((message) => message.type === 'PROGRAMMERS_ACCEPTED');
  const openMessage = sentMessages.find((message) => message.type === 'OPEN_PROBLEM_MEMO_WINDOW');
  return { event: acceptedMessage.event, openedPrompt: openMessage?.prompt || null };
}

async function captureEvent(challengeLevel, selectedLanguage = 'JavaScript') {
  return (await captureAttempt(challengeLevel, selectedLanguage)).event;
}

test('프로그래머스 난이도를 숫자 등급으로 전송한다', async () => {
  const event = await captureEvent('3');
  assert.equal(event.difficulty, 3);
});

test('난이도 메타데이터가 없으면 null을 전송한다', async () => {
  const event = await captureEvent(null);
  assert.equal(event.difficulty, null);
});

test('현재 프로그래머스 언어 드롭다운의 선택값을 전송한다', async () => {
  const event = await captureEvent('2', 'MySQL');
  assert.equal(event.language, 'MySQL');
});

test('일반 프로그래밍 언어는 알고리즘 풀이로 전송한다', async () => {
  const event = await captureEvent('2', 'Python3');
  assert.equal(event.problemType, 'algorithm');
});

test('SQL 언어는 SQL 풀이로 전송한다', async () => {
  for (const language of ['MySQL', 'Oracle']) {
    const event = await captureEvent('2', language);
    assert.equal(event.problemType, 'sql');
  }
});

test('온라인 저장이 완료되고 개인 설정이 켜진 경우에만 문제 메모를 연다', async () => {
  const existingMemo = { algorithmTags: '그리디', approach: '정렬한다' };
  const { openedPrompt } = await captureAttempt('2', 'Python3', {
    ok: true,
    queued: false,
    memoPrompt: { enabled: true, memo: existingMemo },
  });

  assert.equal(openedPrompt.problem.problemId, '12948');
  assert.equal(openedPrompt.memo.algorithmTags, '그리디');
});

test('오프라인 대기열에 저장된 풀이는 문제 메모를 열지 않는다', async () => {
  const { openedPrompt } = await captureAttempt('2', 'Python3', {
    ok: true,
    queued: true,
    memoPrompt: { enabled: true, memo: null },
  });

  assert.equal(openedPrompt, null);
});

test('개인 설정이 꺼진 경우 문제 메모를 열지 않는다', async () => {
  const { openedPrompt } = await captureAttempt('2', 'Python3', {
    ok: true,
    queued: false,
    memoPrompt: { enabled: false, memo: null },
  });

  assert.equal(openedPrompt, null);
});
