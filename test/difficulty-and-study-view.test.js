const assert = require("node:assert/strict")
const { test } = require("node:test")

test("잔디 강도에 각 문제의 난이도를 가중치로 반영한다", async () => {
  const { contributionIntensity, difficultyLabel } = await import("../lib/difficulty.ts")

  assert.equal(contributionIntensity([]), 0)
  assert.equal(contributionIntensity([null]), 1)
  assert.equal(contributionIntensity(["Lv.0"]), 1)
  assert.equal(contributionIntensity(["Lv.1"]), 2)
  assert.equal(contributionIntensity(["Lv.5"]), 6)
  assert.equal(contributionIntensity(["Lv.1", "Lv.2"]), 5)
  assert.equal(contributionIntensity(["Lv.3", "Lv.4"]), 6)
  assert.equal(difficultyLabel(3), "Lv.3")
  assert.equal(difficultyLabel("Lv.3"), "Lv.3")
})

test("스터디 목록은 별도 보기 값이 없으면 참여 중 보기를 사용한다", async () => {
  const { parseStudyDirectoryView } = await import("../lib/study-directory-view.ts")

  assert.equal(parseStudyDirectoryView(undefined), "joined")
  assert.equal(parseStudyDirectoryView("joined"), "joined")
  assert.equal(parseStudyDirectoryView("unknown"), "joined")
  assert.equal(parseStudyDirectoryView("all"), "all")
})
