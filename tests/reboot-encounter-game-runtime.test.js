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
