import assert from 'node:assert/strict';
import test from 'node:test';

import { PLAYER_RULES } from '../src/reboot/content/actions.js';
import { createCombatState, stepCombat } from '../src/reboot/sim/combatSimulation.js';
import { hashState } from '../src/reboot/sim/replay.js';

const target = (id, x = 1, y = 0) => ({ id, position: { x, y }, hp: 100 });

function run(state, ticks, inputAt = () => []) {
  const events = [];
  let next = state;
  for (let index = 0; index < ticks; index += 1) {
    const result = stepCombat(next, inputAt(index));
    next = result.state;
    events.push(...result.events);
  }
  return { state: next, events };
}

function incoming(overrides = {}) {
  return {
    type: 'incoming', contactId: 'shot-1', sourceId: 'stamper',
    position: { x: 1, y: 0 }, kind: 'projectile', damage: 10, ...overrides
  };
}

test('Given a full SIGNAL gauge, When dash, reflect, and trace start, Then each spends its authored cost', () => {
  // Given: 시그널 규칙과 가득 찬 게이지.
  assert.equal(PLAYER_RULES.maxSignal, 100);
  assert.deepEqual(PLAYER_RULES.signalCosts, { attack: 0, dash: 25, reflect: 20, secure: 0, trace: 15 });
  const cases = [
    { command: { type: 'dash' }, remaining: 75 },
    { command: { type: 'reflect' }, remaining: 80 },
    { command: { type: 'trace', targetId: 'memory' }, remaining: 85 }
  ];

  // When: 각 행동을 한 번씩 시작한다.
  for (const sample of cases) {
    const result = stepCombat(createCombatState({ targets: [target('memory', 2)] }), [sample.command]);

    // Then: 시작 즉시 소모량이 정수로 빠지고 signal-changed 이벤트가 같은 값을 알린다.
    assert.equal(result.state.player.signal, sample.remaining, sample.command.type);
    assert.ok(result.events.some((event) => event.type === 'action-started'));
    const changed = result.events.find((event) => event.type === 'signal-changed');
    assert.deepEqual(changed, { type: 'signal-changed', previous: 100, signal: sample.remaining, tick: 0 });
  }
});

test('Given an empty gauge, When costly actions are requested, Then they are refused while attack stays available', () => {
  // Given: 시그널 10만 남은 플레이어(모든 유료 행동의 소모량 미만).
  const state = createCombatState({ signal: 10, targets: [target('a')] });

  // When: 회피를 요청하고, 이어서 공격을 요청한다.
  const blocked = stepCombat(state, [{ type: 'dash' }]);
  const attacked = stepCombat(blocked.state, [{ type: 'attack' }]);

  // Then: 행동 자체가 거부되고(signal-blocked) 게이지는 그대로, attack은 항상 시작된다.
  assert.deepEqual(
    blocked.events.find((event) => event.type === 'signal-blocked'),
    { type: 'signal-blocked', action: 'dash', cost: 25, signal: 10, tick: 0 }
  );
  assert.equal(blocked.events.some((event) => event.type === 'action-started'), false);
  assert.equal(blocked.state.player.action.name, 'idle');
  assert.equal(blocked.state.player.signal, 10);
  assert.ok(attacked.events.some((event) => event.type === 'action-started' && event.action === 'attack1'));
});

test('Given blade hits and a perfect reflect, When they land, Then SIGNAL recovers +10 and +25 up to the cap', () => {
  // Given: 검격 사거리 안의 표적과 시그널 40.
  const hit = run(createCombatState({ signal: 40, targets: [target('a')] }), 12, (tick) => (
    tick === 0 ? [{ type: 'attack' }] : []
  ));

  // Then: target-hit 한 번당 +10 (attack은 소모 0).
  assert.equal(hit.events.filter((event) => event.type === 'target-hit').length, 1);
  assert.equal(hit.state.player.signal, 50);

  // Given: 시그널 50으로 REFLECT(소모 20)를 열고 완벽 프레임에 투사체가 닿는다.
  const reflected = run(createCombatState({ signal: 50 }), 6, (tick) => [
    ...(tick === 0 ? [{ type: 'reflect' }] : []),
    ...(tick === 3 ? [incoming()] : [])
  ]);

  // Then: perfect-reflect가 +25를 돌려준다 (50 - 20 + 25 = 55).
  assert.ok(reflected.events.some((event) => event.type === 'perfect-reflect'));
  assert.equal(reflected.state.player.signal, 55);

  // Given: 가득 찬 게이지로 같은 검격 적중.
  const capped = run(createCombatState({ targets: [target('a')] }), 12, (tick) => (
    tick === 0 ? [{ type: 'attack' }] : []
  ));

  // Then: 상한 100을 넘지 않고 signal-changed도 나지 않는다.
  assert.equal(capped.state.player.signal, 100);
  assert.equal(capped.events.some((event) => event.type === 'signal-changed'), false);
});

test('Given an idle player, When fixed ticks elapse, Then SIGNAL regenerates +4 every 60 ticks as integers', () => {
  // Given: 시그널 0에서 입력 없이 대기하는 플레이어.
  const oneSecond = run(createCombatState({ signal: 0 }), 60);
  const threeSeconds = run(createCombatState({ signal: 0 }), 180);

  // Then: 60틱마다 정확히 +4 — 부동소수 없이 정수만 쌓인다.
  assert.equal(oneSecond.state.player.signal, 4);
  assert.equal(threeSeconds.state.player.signal, 12);
  assert.ok(Number.isInteger(threeSeconds.state.player.signal));
  assert.equal(threeSeconds.events.filter((event) => event.type === 'signal-changed').length, 3);

  // Given: 쓰러진 플레이어는 회복하지 않는다.
  const defeated = run(stepCombat(createCombatState({ signal: 0 }), [incoming({ damage: 999 })]).state, 120);
  assert.equal(defeated.state.player.signal, 0);
});

test('Given the same input sequence, When simulated twice, Then SIGNAL values and state hashes are identical', () => {
  // Given: 소모·차단·적중 회복·자연 회복이 모두 섞인 300틱 입력 시퀀스.
  const inputAt = (tick) => [
    ...(tick % 30 === 0 ? [{ type: 'dash' }] : []),
    ...(tick % 45 === 7 ? [{ type: 'reflect' }] : []),
    ...(tick % 20 === 3 ? [{ type: 'attack' }] : []),
    ...(tick === 100 ? [incoming({ contactId: `c-${tick}` })] : [])
  ];
  const first = run(createCombatState({ signal: 60, targets: [target('a')] }), 300, inputAt);
  const second = run(createCombatState({ signal: 60, targets: [target('a')] }), 300, inputAt);

  // Then: 같은 입력 → 같은 signal, 같은 이벤트, 같은 해시(결정성).
  assert.equal(first.state.player.signal, second.state.player.signal);
  assert.deepEqual(
    first.events.filter((event) => event.type.startsWith('signal')),
    second.events.filter((event) => event.type.startsWith('signal'))
  );
  assert.equal(hashState(first.state), hashState(second.state));
  assert.ok(first.events.some((event) => event.type === 'signal-blocked'));
  assert.ok(first.events.some((event) => event.type === 'signal-changed'));
});
