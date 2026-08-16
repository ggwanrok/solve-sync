const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const contentScript = readFileSync(new URL('../extension/content.js', `file://${__filename}`), 'utf8');

async function captureEvent(challengeLevel) {
  const session = new Map();
  let sentMessage = null;
  const difficultyNodes = challengeLevel == null
    ? []
    : [{ dataset: { challengeLevel, lessonId: '12948' } }];
  const context = vm.createContext({
    chrome: {
      runtime: {
        sendMessage: async (message) => {
          sentMessage = message;
          return { ok: true };
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
        if (selector === '[aria-selected="true"], .language-selector .selected, select') return { value: 'JavaScript' };
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
  return sentMessage.event;
}

test('프로그래머스 난이도를 숫자 등급으로 전송한다', async () => {
  const event = await captureEvent('3');
  assert.equal(event.difficulty, 3);
});

test('난이도 메타데이터가 없으면 null을 전송한다', async () => {
  const event = await captureEvent(null);
  assert.equal(event.difficulty, null);
});
