import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUZZLE_TOPIC_ORDER,
  SHRINE_PUZZLES,
  countMisplaced,
  createPuzzleState,
  cyclePuzzleObject,
  getShrinePuzzle,
  isPuzzleSolved
} from '../src/shrinePuzzle.js';
import { SHRINE_TOOL } from '../src/worldData.js';

test('every zone has a shrine puzzle wired to the right shrine and tool', () => {
  for (const topicId of PUZZLE_TOPIC_ORDER) {
    const puzzle = getShrinePuzzle(topicId);
    assert.ok(puzzle, `${topicId} needs a puzzle`);
    assert.ok(SHRINE_TOOL[puzzle.shrineId], `${topicId} shrine must award a tool`);
    assert.ok(puzzle.objects.length >= 3, `${topicId} needs several objects to manipulate`);
    assert.ok(puzzle.goalKo && puzzle.lessonKo);
  }
});

test('a fresh puzzle starts unsolved (wrong on purpose) so you must fix it', () => {
  for (const topicId of PUZZLE_TOPIC_ORDER) {
    const state = createPuzzleState(topicId);
    assert.equal(state.length, SHRINE_PUZZLES[topicId].objects.length);
    assert.equal(isPuzzleSolved(topicId, state), false, `${topicId} should not start solved`);
  }
});

test('per-object puzzles solve when every stone reaches its correct state', () => {
  for (const topicId of ['privacy', 'copyright', 'deepfake']) {
    const puzzle = SHRINE_PUZZLES[topicId];
    let state = createPuzzleState(topicId);
    // 각 돌을 정답 상태까지 A로 순환.
    puzzle.objects.forEach((obj, i) => {
      while (state[i] !== obj.correct) {
        state = cyclePuzzleObject(topicId, state, i);
      }
    });
    assert.equal(isPuzzleSolved(topicId, state), true, `${topicId} should solve`);
  }
});

test('bias puzzle is relational: solved only when all four colors are distinct', () => {
  let state = createPuzzleState('bias'); // [0,0,0,0] 모두 빨강
  assert.equal(isPuzzleSolved('bias', state), false);
  // 0,1,2,3 서로 다른 색으로.
  state = [0, 1, 2, 3];
  assert.equal(isPuzzleSolved('bias', state), true);
  // 중복이 하나라도 있으면 미해결.
  state = [0, 1, 1, 3];
  assert.equal(isPuzzleSolved('bias', state), false);
});

test('countMisplaced gives a hint count that is zero exactly when solved (per-object)', () => {
  for (const topicId of ['privacy', 'copyright', 'deepfake']) {
    const puzzle = SHRINE_PUZZLES[topicId];
    const fresh = createPuzzleState(topicId);
    // 시작 상태는 어긋난 돌이 하나 이상.
    assert.ok(countMisplaced(topicId, fresh) >= 1);
    // 정답 배치는 0.
    const solved = puzzle.objects.map((o) => o.correct);
    assert.equal(countMisplaced(topicId, solved), 0);
    assert.equal(isPuzzleSolved(topicId, solved), true);
  }
});

test('countMisplaced for the relational (bias) puzzle counts stones needing a change', () => {
  assert.equal(countMisplaced('bias', [0, 0, 0, 0]), 3); // 3개는 바꿔야 모두 다름
  assert.equal(countMisplaced('bias', [0, 1, 1, 3]), 1);
  assert.equal(countMisplaced('bias', [0, 1, 2, 3]), 0);
});

test('cycling wraps around the state ring and never goes out of bounds', () => {
  let state = createPuzzleState('bias');
  for (let i = 0; i < 5; i += 1) {
    state = cyclePuzzleObject('bias', state, 0);
  }
  assert.equal(state[0], 1, '4-state ring cycled 5 times lands on 1');
  // 잘못된 인덱스는 상태를 그대로 둔다.
  const before = state.slice();
  assert.deepEqual(cyclePuzzleObject('bias', state, 99), before);
});
