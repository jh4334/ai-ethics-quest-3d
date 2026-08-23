import test from 'node:test';
import assert from 'node:assert/strict';
import { STORYBOOK_CHAPTERS } from '../src/storybook3d/content.js';
import {
  advanceSpread,
  createStorybookState,
  inspectClue,
  resolveStorybookChoice,
  serializeStorybookState,
  startStorybook
} from '../src/storybook3d/state.js';

test('3D 동화책은 서로 다른 6장과 장마다 3개 펼침면을 가진다', () => {
  assert.equal(STORYBOOK_CHAPTERS.length, 6);
  assert.equal(new Set(STORYBOOK_CHAPTERS.map((chapter) => chapter.sceneId)).size, 6);
  for (const chapter of STORYBOOK_CHAPTERS) {
    assert.equal(chapter.spreads.length, 3);
    assert.equal(chapter.clues.length, 2);
    assert.equal(chapter.choices.length, 2);
    assert.ok(chapter.landmarks.length >= 3);
  }
});

test('독자는 두 단서를 모두 살펴본 뒤에만 선택 펼침면으로 간다', () => {
  let state = startStorybook(createStorybookState());
  state = advanceSpread(state);
  assert.equal(state.spreadIndex, 1);
  assert.equal(advanceSpread(state).spreadIndex, 1);

  const [first, second] = STORYBOOK_CHAPTERS[0].clues;
  state = inspectClue(state, first.id);
  assert.equal(advanceSpread(state).spreadIndex, 1);
  state = inspectClue(state, second.id);
  state = advanceSpread(state);
  assert.equal(state.spreadIndex, 2);
});

test('선택은 얻은 가치와 치른 비용을 보존하고 다음 장을 연다', () => {
  let state = startStorybook(createStorybookState());
  state = advanceSpread(state);
  for (const clue of STORYBOOK_CHAPTERS[0].clues) state = inspectClue(state, clue.id);
  state = advanceSpread(state);
  state = resolveStorybookChoice(state, STORYBOOK_CHAPTERS[0].choices[1].id);

  assert.equal(state.decisions['chapter-1'].choiceId, STORYBOOK_CHAPTERS[0].choices[1].id);
  assert.ok(state.decisions['chapter-1'].value);
  assert.ok(state.decisions['chapter-1'].cost);
  state = advanceSpread(state);
  assert.equal(state.chapterIndex, 1);
  assert.equal(state.spreadIndex, 0);
  assert.equal(state.unlockedChapter, 1);
});

test('저장 데이터는 개인정보 입력 없이 마지막 펼침면과 발견 기록을 복원한다', () => {
  let state = startStorybook(createStorybookState());
  state = advanceSpread(state);
  state = inspectClue(state, STORYBOOK_CHAPTERS[0].clues[0].id);
  const saved = serializeStorybookState(state);
  const restored = createStorybookState(JSON.parse(saved));

  assert.equal(restored.chapterIndex, 0);
  assert.equal(restored.spreadIndex, 1);
  assert.deepEqual(restored.discoveries['chapter-1'], [STORYBOOK_CHAPTERS[0].clues[0].id]);
  assert.doesNotMatch(saved, /name|email|phone|nickname/i);
});

test('v1 동화 저장은 v2 모험 저장으로 바뀌어도 발견과 결정을 잃지 않는다', () => {
  const firstChapter = STORYBOOK_CHAPTERS[0];
  const oldSave = {
    version: 1,
    phase: 'reading',
    chapterIndex: 0,
    spreadIndex: 2,
    unlockedChapter: 1,
    discoveries: { [firstChapter.id]: firstChapter.clues.map((clue) => clue.id) },
    decisions: {
      [firstChapter.id]: {
        choiceId: firstChapter.choices[0].id,
        value: firstChapter.choices[0].value,
        cost: firstChapter.choices[0].cost
      }
    }
  };

  const restored = createStorybookState(oldSave);
  assert.equal(restored.version, 2);
  assert.deepEqual(restored.discoveries[firstChapter.id], oldSave.discoveries[firstChapter.id]);
  assert.equal(restored.decisions[firstChapter.id].choiceId, oldSave.decisions[firstChapter.id].choiceId);
  assert.equal(restored.adventure.chapterIndex, 0);
  assert.equal(restored.adventure.phase, 'explore');
});

test('마지막 장의 선택 뒤 이야기가 완결된다', () => {
  const decisions = Object.fromEntries(STORYBOOK_CHAPTERS.slice(0, 5).map((chapter) => [
    chapter.id,
    {
      choiceId: chapter.choices[0].id,
      value: chapter.choices[0].value,
      cost: chapter.choices[0].cost
    }
  ]));
  let state = createStorybookState({
    version: 1,
    phase: 'reading',
    chapterIndex: 5,
    spreadIndex: 2,
    unlockedChapter: 5,
    discoveries: Object.fromEntries(STORYBOOK_CHAPTERS.map((chapter) => [chapter.id, chapter.clues.map((clue) => clue.id)])),
    decisions
  });
  state = resolveStorybookChoice(state, STORYBOOK_CHAPTERS[5].choices[0].id);
  state = advanceSpread(state);
  assert.equal(state.phase, 'complete');
  assert.equal(state.completed, true);
  assert.equal(Object.keys(state.decisions).length, 6);
});
