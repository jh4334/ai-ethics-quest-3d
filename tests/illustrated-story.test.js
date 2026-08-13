import assert from 'node:assert/strict';
import test from 'node:test';

import { STORY_BEATS, advanceStory, resolveChoice } from '../src/illustrated/story.js';
import * as illustrated from '../src/illustrated/story.js';

test('2D 이야기는 발자국 조사 뒤 한 번의 쉬운 선택으로 이어진다', () => {
  let state = { phase: 'story', step: 0 };
  for (let index = 1; index < STORY_BEATS.length; index += 1) state = advanceStory(state.step);
  assert.deepEqual(state, { phase: 'story', step: STORY_BEATS.length - 1 });
  assert.deepEqual(advanceStory(state.step), { phase: 'choice', step: STORY_BEATS.length - 1 });
});

test('하루에게 먼저 확인하는 선택은 개인정보를 다시 퍼뜨리지 않는다', () => {
  const protectedResult = resolveChoice('protect');
  const recoveryResult = resolveChoice('share');
  assert.equal(protectedResult.phase, 'complete');
  assert.equal(protectedResult.outcome, 'protected');
  assert.equal(recoveryResult.phase, 'recovery');
  assert.equal(recoveryResult.outcome, 'shared');
  assert.match(recoveryResult.line, /먼저 확인/);
});

test('액션판 프롤로그와 결말은 하루·도트·H-17·WHITEOUT 정본을 잇는다', () => {
  assert.ok(Array.isArray(illustrated.ACTION_PROLOGUE));
  assert.equal(illustrated.ACTION_PROLOGUE.length, 3);
  assert.match(illustrated.ACTION_PROLOGUE.map(({ line }) => line).join(' '), /하루/);
  assert.match(illustrated.ACTION_PROLOGUE.map(({ line }) => line).join(' '), /도트/);
  assert.match(illustrated.ACTION_PROLOGUE.map(({ line }) => line).join(' '), /H-17/);
  assert.match(illustrated.ACTION_ENDING.line, /WHITEOUT/);
  assert.match(illustrated.ACTION_ENDING.line, /동의/);
});
