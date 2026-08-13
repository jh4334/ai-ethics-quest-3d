import assert from 'node:assert/strict';
import test from 'node:test';

import { createEncounterGameRuntime } from '../src/reboot/app/encounterGameRuntime.js';

function advance(runtime, ticks, environment = {}) {
  const combatEvents = [];
  const enemyEvents = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const result = runtime.update(1 / 60, {}, environment);
    combatEvents.push(...result.combatEvents);
    enemyEvents.push(...result.enemyEvents);
  }
  return { combatEvents, enemyEvents, state: runtime.getState() };
}

test('Given the player inside the authored arena, When combat advances, Then enemies acquire locally', () => {
  // Given: 첫 전투 중앙에 선 플레이어와 원래 mixed arena.
  const runtime = createEncounterGameRuntime({ startPosition: { x: 0, y: -39 } });

  // When: 적 인지 루프가 시작된다.
  const result = advance(runtime, 12);

  // Then: 기존 근거리 교전은 그대로 유지된다.
  assert.equal(result.state.encounter.enemies.some((enemy) => enemy.targetId === 'player'), true);
});

test('저작 시작 방향은 이동 전 캐릭터와 첫 공격을 다음 목표 쪽으로 향하게 한다', () => {
  const runtime = createEncounterGameRuntime({
    startFacing: { x: 0, y: -2 },
    startPosition: { x: 0, y: -17 }
  });

  assert.deepEqual(runtime.getState().combat.player.facing, { x: 0, y: -1 });
});

test('Given the player leaves the first arena, When the route continues, Then enemies cannot chase into later scenes', () => {
  // Given: mixed arena 전투가 시작된 뒤 다음 복도로 달리는 플레이어.
  const runtime = createEncounterGameRuntime({ startPosition: { x: 0, y: -39 } });
  advance(runtime, 12);

  // When: 플레이어가 기억 백업 구간보다 멀리 이동한다.
  for (let tick = 0; tick < 360; tick += 1) {
    runtime.update(1 / 60, { horizontal: 0, vertical: -1 });
  }
  const enemies = runtime.getState().encounter.enemies;

  // Then: 첫 전투 적은 추적을 놓고 자기 전투 구역을 벗어나지 않는다.
  assert.equal(enemies.every((enemy) => enemy.targetId === null), true);
  assert.equal(enemies.every((enemy) => (
    Math.hypot(enemy.position.x - enemy.spawn.position.x, enemy.position.z - enemy.spawn.position.z) <= 13
  )), true);
});

test('같은 입력은 적과 플레이어가 결합된 동일한 60Hz 결과를 만든다', () => {
  const play = () => {
    const runtime = createEncounterGameRuntime({ startPosition: { x: -8, y: -39 } });
    advance(runtime, 20);
    runtime.queueAction('reflect');
    return advance(runtime, 140);
  };

  assert.deepEqual(play(), play());
});

test('스탬퍼 사격 반사는 이레이저 방어를 한 번만 연다', () => {
  const runtime = createEncounterGameRuntime({ startPosition: { x: -8, y: -39 } });
  let reflected = false;
  const enemyEvents = [];
  for (let tick = 0; tick < 240; tick += 1) {
    const before = runtime.getState();
    if (!reflected && before.encounter.enemies.some((enemy) => (
      enemy.id === 'stamper-mixed' && enemy.phase === 'windup' && enemy.phaseTick >= 8
    ))) {
      runtime.queueAction('reflect');
      reflected = true;
    }
    enemyEvents.push(...runtime.update(1 / 60).enemyEvents);
  }

  const eraser = runtime.getState().encounter.enemies.find((enemy) => enemy.id === 'eraser-mixed');
  assert.equal(eraser.armor, 0);
  assert.equal(enemyEvents.filter((event) => event.type === 'armor-broken').length, 1);
  assert.equal(enemyEvents.filter((event) => event.type === 'reward-granted').length, 1);
});

test('가림 또는 화면 밖의 스탬퍼는 플레이어 체력을 줄이지 못한다', () => {
  for (const environment of [
    { onScreen: false },
    { blockers: [{ id: 'locker', minX: -6, maxX: -4, minZ: -40, maxZ: -37 }] }
  ]) {
    const runtime = createEncounterGameRuntime({ startPosition: { x: -8, y: -39 } });
    const result = advance(runtime, 240, environment);
    assert.equal(result.state.combat.player.hp, 100);
    assert.equal(result.enemyEvents.some((event) => event.type === 'attack-contact'), false);
  }
});

test('재시작은 전투, 조우, 대기 중 접촉을 모두 초기화한다', () => {
  const runtime = createEncounterGameRuntime({ startPosition: { x: -8, y: -39 } });
  advance(runtime, 90);
  const reset = runtime.reset();

  assert.equal(reset.combat.tick, 0);
  assert.equal(reset.combat.player.hp, 100);
  assert.equal(reset.encounter.tick, 0);
  assert.equal(reset.encounter.enemies.every((enemy) => enemy.phase === 'idle'), true);
});
