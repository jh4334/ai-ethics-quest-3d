import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdventureState,
  stepAdventure
} from '../src/storybook3d/adventureGame.js';
import { getAdventureZone } from '../src/storybook3d/adventureContent.js';

function run(state, input, ticks = 1) {
  let next = state;
  for (let tick = 0; tick < ticks; tick += 1) next = stepAdventure(next, input, 1 / 60);
  return next;
}

function moveNear(state, x, z) {
  return { ...state, player: { ...state.player, x, z } };
}

test('탑다운 모험은 이동하고 섬 경계 밖으로 나가지 않는다', () => {
  let state = createAdventureState(0);
  state = run(state, { right: true }, 180);
  assert.ok(state.player.x > 2);
  state = run(state, { right: true, down: true }, 600);
  assert.equal(state.player.x, 8);
  assert.equal(state.player.z, 6);
});

test('여섯 장은 같은 규칙을 쓰되 서로 다른 섬과 먹물지기를 가진다', () => {
  const chapters = Array.from({ length: 6 }, (_, chapterIndex) => getAdventureZone(chapterIndex));
  const states = chapters.map((_, chapterIndex) => createAdventureState(chapterIndex));
  assert.equal(states.length, 6);
  assert.deepEqual(states.map((state) => state.chapterIndex), [0, 1, 2, 3, 4, 5]);
  assert.equal(new Set(chapters.map((chapter) => chapter.chapterId)).size, 6);
  assert.equal(new Set(chapters.map((chapter) => chapter.boss)).size, 6);
});

test('단서와 문양을 찾고 열쇠를 얻어야 기록문과 보스를 통과한다', () => {
  let state = createAdventureState(0);
  state = moveNear(state, -4.5, -2.7);
  state = run(state, { interact: true });
  state = moveNear(state, 0.2, -3.7);
  state = run(state, { interact: true });
  assert.equal(state.clues.length, 2);

  state = moveNear(state, -3.5, 1.8);
  state = run(state, { interact: true });
  state = moveNear(state, 3.5, 1.8);
  state = run(state, { interact: true });
  assert.equal(state.puzzleSolved, true);

  state = moveNear(state, 0, 0.4);
  state = run(state, { interact: true });
  assert.equal(state.hasKey, true);

  const beforeGate = createAdventureState(0);
  const locked = run(moveNear(beforeGate, 0, -4.9), { interact: true });
  assert.equal(locked.gateOpen, false);
  assert.match(locked.message, /열쇠/);

  state = moveNear(state, 0, -4.9);
  state = run(state, { interact: true });
  assert.equal(state.gateOpen, true);
  assert.equal(state.boss.active, true);

  state = moveNear(state, state.boss.x, state.boss.z + 1);
  for (let hit = 0; hit < 6; hit += 1) {
    state = run(state, { attack: true });
    state = run(state, {}, 24);
  }
  assert.equal(state.boss.defeated, true);
  assert.equal(state.phase, 'choice');
});

test('공격 재사용 대기시간과 정면 방어가 입력 연타를 막는다', () => {
  let state = createAdventureState(0);
  state = {
    ...state,
    player: { ...state.player, x: 0, z: 0, facingX: 1, facingZ: 0 },
    enemies: [{ id: 'ink-sprout', x: 0.8, z: 0, hp: 3, defeated: false, attackCooldown: 0 }]
  };
  state = run(state, { attack: true });
  const afterFirst = state.enemies[0].hp;
  state = run(state, { attack: true }, 4);
  assert.equal(state.enemies[0].hp, afterFirst);

  const health = state.player.health;
  state = { ...state, enemies: [{ ...state.enemies[0], x: 0.55, attackCooldown: 0 }] };
  state = run(state, { guard: true });
  assert.equal(state.player.health, health);
  assert.match(state.message, /막/);
});
