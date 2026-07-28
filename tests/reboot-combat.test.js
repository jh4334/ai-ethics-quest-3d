import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTIONS, FIXED_HZ } from '../src/reboot/content/actions.js';
import { createCombatState, stepCombat } from '../src/reboot/sim/combatSimulation.js';
import { advanceElapsed } from '../src/reboot/sim/fixedStep.js';
import { hashState, runReplay } from '../src/reboot/sim/replay.js';

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

test('Given REFLECT timing, When a contact arrives early, perfectly, or late, Then authority follows the active window', () => {
  // Given: 세 개의 동일한 정면 투사체 조우.
  const cases = [
    { tick: 1, kind: 'player-hit' },
    { tick: 3, kind: 'perfect-reflect' },
    { tick: 8, kind: 'player-hit' }
  ];

  // When: 각 투사체가 REFLECT의 서로 다른 프레임에 닿는다.
  for (const sample of cases) {
    const result = run(createCombatState(), 10, (tick) => [
      ...(tick === 0 ? [{ type: 'reflect' }] : []),
      ...(tick === sample.tick ? [incoming()] : [])
    ]);

    // Then: 활성/완벽 구간만 반사 판정을 소유한다.
    assert.ok(result.events.some((event) => event.type === sample.kind), sample.kind);
  }
});

test('Given an active REFLECT, When contact is behind or out of range, Then it hits instead of reflecting', () => {
  // Given: REFLECT 활성 프레임까지 진행한 상태.
  const base = run(createCombatState(), 3, (tick) => tick === 0 ? [{ type: 'reflect' }] : []).state;

  // When: 뒤쪽 접촉과 먼 접촉을 각각 판정한다.
  const behind = stepCombat(base, [incoming({ position: { x: -1, y: 0 } })]);
  const far = stepCombat(base, [incoming({ contactId: 'shot-2', position: { x: 9, y: 0 } })]);

  // Then: 방향과 거리 계약을 벗어나면 플레이어 피격이다.
  assert.ok(behind.events.some((event) => event.type === 'player-hit'));
  assert.ok(far.events.some((event) => event.type === 'player-hit'));
});

test('Given committed actions, When hit, repeated input, cancel, and stale input occur, Then transitions stay explicit', () => {
  // Given: TRACE를 시작하고 매 틱 공격 입력을 넣는 상태.
  let state = createCombatState({ targets: [target('memory', 2)] });
  let result = stepCombat(state, [{ type: 'trace', targetId: 'memory' }]);
  state = result.state;

  // When: 시작 중 피격되어 중단되고, 회복 중 반복 입력과 오래된 버퍼를 보낸다.
  result = stepCombat(state, [incoming(), { type: 'attack' }, { type: 'attack' }]);
  const interrupted = result.events;
  const settled = run(result.state, 80, () => [{ type: 'attack' }]);
  const tracing = stepCombat(createCombatState({ targets: [target('memory', 2)] }), [{ type: 'trace', targetId: 'memory' }]).state;
  const cancelled = stepCombat(tracing, [{ type: 'cancel' }]);
  const defeated = stepCombat(createCombatState(), [incoming({ damage: 999 })]);
  const ignoredAfterDefeat = stepCombat(defeated.state, [{ type: 'attack' }]);

  // Then: TRACE는 중단되고, 공격 시작 수는 시간 계약보다 많지 않으며 취소는 안전하다.
  assert.ok(interrupted.some((event) => event.type === 'action-cancelled'));
  assert.ok(settled.events.filter((event) => event.type === 'action-started').length <= 8);
  assert.ok(cancelled.events.some((event) => event.type === 'action-cancelled'));
  assert.equal(cancelled.state.player.action.name, 'idle');
  assert.equal(ignoredAfterDefeat.state.player.action.name, 'defeat');
  assert.equal(ignoredAfterDefeat.state.player.status, 'defeated');
  assert.ok(settled.state.player.buffer === null || settled.state.player.buffer.expiresTick >= settled.state.tick);
});

test('Given multiple targets, When one blade window overlaps repeatedly, Then each target receives one unique hit id', () => {
  // Given: 두 표적이 같은 검격 범위에 있다.
  const state = createCombatState({ targets: [target('a'), target('b', 1.2, 0.2)] });

  // When: 첫 타의 전체 활성 프레임을 실행한다.
  const result = run(state, 20, (tick) => tick === 0 ? [{ type: 'attack' }] : []);
  const hits = result.events.filter((event) => event.type === 'target-hit');

  // Then: 표적별 한 번, 서로 다른 권위 hit id가 발행된다.
  assert.deepEqual(hits.map((event) => event.targetId).sort(), ['a', 'b']);
  assert.equal(new Set(hits.map((event) => event.hitId)).size, 2);
});

test('Given a paused simulation, When ticks and inputs arrive, Then state time and buffers do not advance', () => {
  // Given: 일시정지 명령을 받은 전투.
  const paused = stepCombat(createCombatState(), [{ type: 'pause' }]).state;

  // When: 이동과 공격을 포함한 30회 호출 뒤 재개한다.
  const held = run(paused, 30, () => [{ type: 'move', x: 1, y: 0 }, { type: 'attack' }]).state;
  const resumed = stepCombat(held, [{ type: 'resume' }]).state;

  // Then: 일시정지 중 권위 틱과 위치는 그대로다.
  assert.equal(held.tick, paused.tick);
  assert.deepEqual(held.player.position, paused.player.position);
  assert.equal(resumed.paused, false);
});

test('Given the same held movement, When rendered at 30/60/120Hz, Then fixed-step states are identical', () => {
  // Given: 2초 동안 오른쪽 이동하는 동일 입력.
  const simulate = (frameHz) => {
    let runtime = { accumulator: 0, state: createCombatState() };

    // When: 서로 다른 렌더 주기로 같은 실시간을 누적한다.
    for (let frame = 0; frame < frameHz * 2; frame += 1) {
      runtime = advanceElapsed(runtime, 1 / frameHz, [{ type: 'move', x: 1, y: 0 }]);
    }
    return runtime;
  };
  const results = [30, 60, 120].map(simulate);

  // Then: 권위 상태와 남은 누적량이 동일하다.
  assert.deepEqual(results.map((result) => result.state.tick), [FIXED_HZ * 2, FIXED_HZ * 2, FIXED_HZ * 2]);
  assert.equal(new Set(results.map((result) => hashState(result.state))).size, 1);
});

test('Given one edge attack, When a frame contains zero or multiple fixed ticks, Then it is consumed exactly once', () => {
  // Given: 첫 렌더 프레임에만 공격 edge가 들어오는 30/60/120Hz 실행.
  const simulate = (frameHz) => {
    let runtime = { accumulator: 0, pendingEdges: [], state: createCombatState() };
    const events = [];

    // When: 1초를 실행하며 이동은 held, 공격은 첫 프레임에만 제출한다.
    for (let frame = 0; frame < frameHz; frame += 1) {
      const commands = [{ type: 'move', x: 1, y: 0 }];
      if (frame === 0) commands.push({ type: 'attack' });
      runtime = advanceElapsed(runtime, 1 / frameHz, commands);
      events.push(...runtime.events);
    }
    return { runtime, starts: events.filter((event) => event.type === 'action-started') };
  };
  const results = [30, 60, 120].map(simulate);

  // Then: 모든 주기에서 공격 시작은 한 번이며 최종 상태가 같다.
  assert.deepEqual(results.map((result) => result.starts.length), [1, 1, 1]);
  assert.equal(new Set(results.map((result) => hashState(result.runtime.state))).size, 1);
  assert.deepEqual(results.map((result) => result.runtime.pendingEdges.length), [0, 0, 0]);
});

test('Given per-tick action spam, When commitment windows run, Then startup and recovery cannot be bypassed', () => {
  // Given: 모든 액션을 매 틱 제출하는 입력.
  const spam = () => ['attack', 'dash', 'reflect'].map((type) => ({ type }));

  // When: 120틱 동안 반복한다.
  const result = run(createCombatState({ targets: [target('a')] }), 120, spam);
  const starts = result.events.filter((event) => event.type === 'action-started');

  // Then: 한 틱에 하나만 시작되고 각 인스턴스 번호는 유일하다.
  assert.equal(new Set(starts.map((event) => event.instanceId)).size, starts.length);
  const minimumCommitment = ACTIONS.attack1.startupTicks + ACTIONS.attack1.activeTicks;
  assert.ok(starts.length <= Math.ceil(120 / minimumCommitment) + 1);
});

test('Given a replay log, When run twice and interrupted in chunks, Then event order and final hash match', () => {
  // Given: 이동, 콤보, 반사, TRACE, SECURE 입력 로그.
  const log = [
    { tick: 0, commands: [{ type: 'dash' }] },
    { tick: 12, commands: [{ type: 'attack' }] },
    { tick: 23, commands: [{ type: 'attack' }] },
    { tick: 35, commands: [{ type: 'attack' }] },
    { tick: 52, commands: [{ type: 'reflect' }] },
    { tick: 55, commands: [incoming({ position: { x: 3.2, y: 0 } })] },
    { tick: 65, commands: [{ type: 'trace', targetId: 'memory' }] },
    { tick: 82, commands: [{ type: 'secure', targetId: 'memory' }] }
  ];
  const initial = createCombatState({ targets: [target('enemy', 3.2), target('memory', 3.8)] });

  // When: 같은 로그를 두 번 재생한다.
  const first = runReplay({ initialState: initial, inputLog: log, ticks: 110 });
  const second = runReplay({ initialState: initial, inputLog: log, ticks: 110 });
  const interrupted = runReplay({ initialState: initial, inputLog: log, ticks: 40 });
  const resumed = runReplay({ initialState: interrupted.state, inputLog: log, ticks: 70 });

  // Then: 체인 3, 보안 사건 순서, 최종 해시가 일치한다.
  assert.equal(first.state.chain.level, 3);
  assert.ok(first.events.findIndex((event) => event.type === 'traced') < first.events.findIndex((event) => event.type === 'secured'));
  assert.equal(first.hash, second.hash);
  assert.equal(first.hash, resumed.hash);
  assert.deepEqual(first.events, [...interrupted.events, ...resumed.events]);
  assert.deepEqual(first.events, second.events);
});

test('Given malformed input and a five-minute encounter, When simulated headlessly, Then transient state stays bounded', () => {
  // Given: 알 수 없는 입력과 매 틱 고유/중복 접촉이 섞인 5분 로그.
  const state = createCombatState({ targets: [target('a')] });

  // When: 18,000 고정 틱을 빠르게 실행한다.
  const result = run(state, FIXED_HZ * 60 * 5, (tick) => [
    { type: tick % 2 ? 'unknown' : 'reflect' },
    incoming({ contactId: `stress-${Math.floor(tick / 2)}`, damage: 0 })
  ]);
  const contacts = result.events.filter((event) => ['player-hit', 'reflected', 'perfect-reflect', 'evaded'].includes(event.type));

  // Then: 같은 접촉 ID는 한 번만 권위를 갖고 큐/캐시는 상한 이하다.
  assert.equal(new Set(contacts.map((event) => event.contactId)).size, contacts.length);
  assert.ok(result.state.transient.processedContacts.length <= 256);
  assert.ok(result.state.player.buffer === null || Object.keys(result.state.player.buffer).length <= 2);
});
