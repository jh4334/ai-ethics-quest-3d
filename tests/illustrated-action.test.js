import test from 'node:test';
import assert from 'node:assert/strict';

import * as illustrated from '../src/illustrated/story.js';

function getRuntime() {
  const names = [
    'ACTION_EVIDENCE',
    'createActionGameState',
    'advanceChapter',
    'createInputState',
    'mapControlAction',
    'setInputAction',
    'resolveChapterChoice',
    'stepActionGame',
    'serializeActionGame'
  ];
  for (const name of names) {
    assert.equal(typeof illustrated[name] === 'function' || Array.isArray(illustrated[name]), true, `${name} 2D 액션 계약이 필요합니다.`);
  }
  return illustrated;
}

function stepFrames(runtime, state, input, frames) {
  for (let frame = 0; frame < frames; frame += 1) runtime.stepActionGame(state, input, 1 / 60);
}

function tap(runtime, state, input, action, settleFrames = 20) {
  runtime.setInputAction(input, action, true);
  runtime.stepActionGame(state, input, 1 / 60);
  runtime.setInputAction(input, action, false);
  stepFrames(runtime, state, input, settleFrames);
}

test('개인정보부터 딥페이크까지 원래 네 증거 순서를 유지한다', () => {
  const runtime = getRuntime();
  assert.deepEqual(
    runtime.ACTION_EVIDENCE.map(({ id, label }) => [id, label]),
    [
      ['privacy', '개인정보'],
      ['bias', '편향'],
      ['copyright', '저작권'],
      ['deepfake', '딥페이크']
    ]
  );
});

test('키보드와 터치 조작이 같은 입력 상태를 만든다', () => {
  const runtime = getRuntime();
  const keyboard = runtime.createInputState();
  const touch = runtime.createInputState();

  runtime.setInputAction(keyboard, runtime.mapControlAction('KeyD'), true);
  runtime.setInputAction(touch, runtime.mapControlAction('touch-right'), true);
  assert.deepEqual(touch, keyboard);

  runtime.setInputAction(keyboard, runtime.mapControlAction('KeyJ'), true);
  runtime.setInputAction(touch, runtime.mapControlAction('touch-attack'), true);
  assert.deepEqual(touch, keyboard);
});

test('이동·점프·공격은 고정틱에서 실제 플레이 상태를 바꾼다', () => {
  const runtime = getRuntime();
  const state = runtime.createActionGameState();
  const input = runtime.createInputState();
  const startX = state.player.x;

  runtime.setInputAction(input, 'right', true);
  stepFrames(runtime, state, input, 30);
  runtime.setInputAction(input, 'right', false);
  assert.ok(state.player.x > startX + 40);

  runtime.setInputAction(input, 'jump', true);
  runtime.stepActionGame(state, input, 1 / 60);
  runtime.setInputAction(input, 'jump', false);
  assert.ok(state.player.y < state.world.groundY);

  const enemy = state.enemies[0];
  state.player.x = enemy.x - 42;
  state.player.y = state.world.groundY;
  const hpBefore = enemy.hp;
  tap(runtime, state, input, 'attack');
  assert.ok(enemy.hp < hpBefore);
});

test('긴 월드에서 카메라가 플레이어를 따라가고 지면은 화면 반대 방향으로 흐른다', () => {
  const runtime = getRuntime();
  assert.equal(typeof runtime.createSideScrollSceneLayout, 'function', '횡스크롤 화면 좌표 계약이 필요합니다.');
  const state = runtime.createActionGameState();
  const input = runtime.createInputState();
  runtime.setInputAction(input, 'right', true);
  stepFrames(runtime, state, input, 240);
  runtime.setInputAction(input, 'right', false);

  const layout = runtime.createSideScrollSceneLayout(state, 1280);
  assert.ok(state.world.width >= 4600, '한 장의 배경이 아니라 최소 3.5 화면 길이의 월드여야 합니다.');
  assert.ok(state.cameraX > 700, '카메라가 실제 월드 진행을 따라가야 합니다.');
  assert.ok(layout.playerScreenX >= 340 && layout.playerScreenX <= 440, '플레이어는 카메라 추적점 근처에 남아야 합니다.');
  assert.equal(layout.landmarks[0].screenX, layout.landmarks[0].worldX - state.cameraX);
  assert.ok(Math.abs(layout.farBackgroundX) < state.cameraX * 0.25, '원경은 지면보다 느리게 움직여야 합니다.');

  const mobileState = runtime.createActionGameState();
  const mobileInput = runtime.createInputState();
  runtime.setInputAction(mobileInput, 'right', true);
  for (let frame = 0; frame < 240; frame += 1) runtime.stepActionGame(mobileState, mobileInput, 1 / 60, 640);
  assert.equal(mobileState.player.x - mobileState.cameraX, 640, '세로 화면에서는 중앙 크롭 안에 플레이어가 남아야 합니다.');
});

test('공격이 닿는 거리에서는 접촉 피해 없이 드론을 상대할 수 있다', () => {
  const runtime = getRuntime();
  const state = runtime.createActionGameState();
  const input = runtime.createInputState();
  const enemy = state.enemies[0];
  state.player.x = enemy.x - 50;
  state.player.y = state.world.groundY;
  const hpBefore = state.player.hp;

  tap(runtime, state, input, 'attack');

  assert.equal(state.player.hp, hpBefore);
  assert.equal(enemy.hp, 1);
});

test('각 장의 두 증거와 보스를 통과하면 선택을 기록하고 다음 장을 연다', () => {
  const runtime = getRuntime();
  const state = runtime.createActionGameState();
  const input = runtime.createInputState();
  state.player.hp = 99;

  for (const evidence of state.evidence) {
    const enemy = state.enemies.find(({ id }) => id === evidence.enemyId);
    state.player.x = enemy.x - 42;
    state.player.y = state.world.groundY;
    while (enemy.hp > 0) tap(runtime, state, input, 'attack');

    state.player.x = evidence.x;
    tap(runtime, state, input, 'trace', 2);
  }

  assert.equal(state.collectedEvidence.length, 2);
  assert.equal(state.boss.active, true);

  state.player.x = state.boss.x - 58;
  state.player.y = state.world.groundY;
  while (state.boss.hp > 0) tap(runtime, state, input, 'attack');
  assert.equal(state.boss.staggered, true);

  tap(runtime, state, input, 'trace', 2);
  assert.equal(state.phase, 'choice');
  runtime.resolveChapterChoice(state, 'protect-context');
  assert.equal(state.phase, 'chapter-result');
  assert.equal(state.decisions['chapter-1'], 'protect-context');
  runtime.advanceChapter(state);
  assert.equal(state.chapterIndex, 1);
  assert.equal(state.phase, 'playing');
});

test('같은 입력 시퀀스는 완전히 같은 결과를 만든다', () => {
  const runtime = getRuntime();
  const first = runtime.createActionGameState();
  const second = runtime.createActionGameState();
  const firstInput = runtime.createInputState();
  const secondInput = runtime.createInputState();

  runtime.setInputAction(firstInput, 'right', true);
  runtime.setInputAction(secondInput, 'right', true);
  for (let frame = 0; frame < 240; frame += 1) {
    const attack = frame === 120;
    runtime.setInputAction(firstInput, 'attack', attack);
    runtime.setInputAction(secondInput, 'attack', attack);
    runtime.stepActionGame(first, firstInput, 1 / 60);
    runtime.stepActionGame(second, secondInput, 1 / 60);
  }

  assert.deepEqual(first, second);
});

test('저장은 6장 체크포인트·증거·선택만 남기고 런타임 전투 정보는 버린다', () => {
  const runtime = getRuntime();
  const state = runtime.createActionGameState();
  state.checkpointX = 930;
  state.collectedEvidence.push('chapter-1:request');
  state.evidence[0].collected = true;
  state.decisions['chapter-1'] = 'protect-context';
  state.player.x = 1111;
  state.player.hp = 1;
  state.boss.hp = 2;
  state.respawns = 4;

  const saved = runtime.serializeActionGame(state);
  assert.deepEqual(Object.keys(saved).sort(), ['chapterIndex', 'checkpointX', 'completed', 'decisions', 'evidenceIds', 'unlockedChapter', 'version']);
  assert.deepEqual(saved, {
    version: 3,
    chapterIndex: 0,
    unlockedChapter: 0,
    checkpointX: 930,
    evidenceIds: ['chapter-1:request'],
    decisions: { 'chapter-1': 'protect-context' },
    completed: false
  });

  const reloaded = runtime.createActionGameState(saved);
  assert.equal(reloaded.player.x, 930);
  assert.equal(reloaded.player.hp, 4);
  assert.equal(reloaded.boss.hp, 0);
  assert.deepEqual(reloaded.collectedEvidence, ['chapter-1:request']);
  assert.equal(reloaded.decisions['chapter-1'], 'protect-context');
  assert.equal(reloaded.respawns, 0);
});
