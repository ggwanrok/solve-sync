const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const contentScript = readFileSync(new URL('../extension/content.js', `file://${__filename}`), 'utf8');

async function captureEvent(challengeLevel, selectedLanguage = 'JavaScript', artifacts = {}) {
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
        if (selector.startsWith('.dropdown-language .dropdown-toggle')) return { innerText: selectedLanguage };
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '[data-challenge-level]') return difficultyNodes;
        if (selector === '.challenge-content .guide-section-description' && artifacts.problemContent) {
          return artifacts.problemContent.map((value) => ({ innerText: value, textContent: value }));
        }
        if (selector === '.monaco-editor .view-lines .view-line' && artifacts.solutionLines) {
          return artifacts.solutionLines.map((value) => ({ textContent: value }));
        }
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

test('문제 내용과 풀이 코드를 정답 이벤트에 함께 담는다', async () => {
  const event = await captureEvent('2', 'JavaScript', {
    problemContent: ['문제 설명\n전화번호의 일부를 가립니다.', '제한 조건\n길이는 4 이상입니다.'],
    solutionLines: ['function solution(phoneNumber) {', '  return phoneNumber.slice(-4);', '}'],
  });

  assert.match(event.problemContent, /전화번호의 일부/);
  assert.match(event.problemContent, /제한 조건/);
  assert.equal(event.solutionCode, 'function solution(phoneNumber) {\n  return phoneNumber.slice(-4);\n}');
});
