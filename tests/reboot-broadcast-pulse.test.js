import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PULSE_RULES, createBroadcastProtocolState, stepBroadcastProtocol
} from '../src/reboot/bosses/broadcastProtocol.js';
import { createFinaleFixture } from '../src/reboot/campaign/finaleFixtures.js';

// S3c — LUMEN 압박 펄스: 40틱 배수마다 윈드업(30틱) → K(반사)로 무효화하거나 HP -12.
// HP 0은 사망이 아니라 현재 단계 리셋(진행 유지). 아래 테스트가 규칙 수치를 못 박는다.

function freshState() {
  return createBroadcastProtocolState(createFinaleFixture('raw').campaign);
}

// 입력 없이 n틱 진행하며 (틱, 이벤트) 로그를 모은다 — 스케줄 결정성 검증용.
function run(state, ticks) {
  const log = [];
  let current = state;
  for (let index = 0; index < ticks; index += 1) {
    const step = stepBroadcastProtocol(current);
    current = step.state;
    for (const event of step.events) log.push({ tick: current.tick, type: event.type });
  }
  return { log, state: current };
}

// 조건이 참이 될 때까지 입력 없이 진행한다(한계 초과 시 실패).
function runUntil(state, predicate, limit = 2000) {
  const log = [];
  let current = state;
  for (let index = 0; index < limit; index += 1) {
    const step = stepBroadcastProtocol(current);
    current = step.state;
    for (const event of step.events) log.push({ event, tick: current.tick });
    if (predicate(step.events, current)) return { log, state: current };
  }
  throw new Error('한계 틱 안에서 조건에 도달하지 못했습니다.');
}

test('압박 펄스 스케줄은 결정적이다 — 같은 진행은 같은 틱에 윈드업·명중을 만든다', () => {
  // Given: 같은 시드에서 만든 두 상태를 입력 없이 동일하게 진행한다.
  const first = run(freshState(), 120);
  const second = run(freshState(), 120);
  const pulses = (log) => log.filter(({ type }) => type.startsWith('lumen-pulse'));

  // Then: 윈드업은 40·80틱, 명중은 70·110틱 — 두 실행이 완전히 일치한다(난수 0).
  assert.deepEqual(pulses(first.log), pulses(second.log));
  assert.deepEqual(pulses(first.log), [
    { tick: 40, type: 'lumen-pulse-windup' },
    { tick: 70, type: 'lumen-pulse-hit' },
    { tick: 80, type: 'lumen-pulse-windup' },
    { tick: 110, type: 'lumen-pulse-hit' },
    { tick: 120, type: 'lumen-pulse-windup' }
  ]);
  assert.equal(first.state.playerHp, PULSE_RULES.maxPlayerHp - PULSE_RULES.damage * 2);
});

test('윈드업 중의 반사는 펄스를 무효화하고 SIGNAL을 +10 올린다', () => {
  // Given: 첫 윈드업이 시작된 순간(40틱, 잔여 30틱).
  const { state: windup } = runUntil(freshState(), (events) => (
    events.some((event) => event.type === 'lumen-pulse-windup')
  ));
  assert.equal(windup.pulseWindupRemaining, PULSE_RULES.windupTicks);

  // When: K(반사)를 누른다.
  const blocked = stepBroadcastProtocol(windup, { actions: [{ id: 'guard-1', type: 'reflect' }] });

  // Then: 무효화 이벤트 + SIGNAL +10, HP는 그대로, 다음 윈드업(80틱)까지 명중이 없다.
  assert.equal(blocked.events.some((event) => event.type === 'lumen-pulse-blocked'), true);
  assert.equal(blocked.events.some((event) => event.type === 'protocol-rejected'), false);
  assert.equal(blocked.state.pulseWindupRemaining, null);
  assert.equal(blocked.state.playerSignal, PULSE_RULES.startSignal + PULSE_RULES.blockSignalGain);
  assert.equal(blocked.state.playerHp, PULSE_RULES.maxPlayerHp);
  const { log } = runUntil(blocked.state, (events) => (
    events.some((event) => event.type === 'lumen-pulse-windup')
  ));
  assert.equal(log.some(({ event }) => event.type === 'lumen-pulse-hit'), false);
  assert.equal(log.at(-1).tick, 80);
});

test('막지 못한 펄스는 명중해 HP를 12 깎는다', () => {
  // Given/When: 방어 입력 없이 첫 명중까지 진행한다.
  const { log, state } = runUntil(freshState(), (events) => (
    events.some((event) => event.type === 'lumen-pulse-hit')
  ));

  // Then: 70틱에 damage 12로 명중하고 HP 88이 된다.
  const hit = log.find(({ event }) => event.type === 'lumen-pulse-hit');
  assert.equal(hit.tick, 70);
  assert.equal(hit.event.damage, PULSE_RULES.damage);
  assert.equal(state.playerHp, 88);
  assert.equal(state.status, 'active');
});

test('HP 0은 사망이 아니라 현재 단계 리셋이다 — 진행한 단계·보스 HP·SIGNAL은 유지된다', () => {
  // Given: 1단계(reflect-shield)를 숙련해 2단계로 진행한 상태.
  let state = freshState();
  while (state.phaseTick < 18) state = stepBroadcastProtocol(state).state;
  state = stepBroadcastProtocol(state, { actions: [{ id: 'm0', type: 'reflect' }] }).state;
  assert.equal(state.phaseIndex, 1);
  assert.equal(state.hp, 150);

  // When: 방어 없이 명중을 반복해 HP가 0에 닿는다(12씩 9번).
  const { log, state: reset } = runUntil(state, (events) => (
    events.some((event) => event.type === 'phase-reset')
  ));

  // Then: 무처벌 — 현재 단계 틱만 0으로, HP 100 복구, 단계·보스 HP·SIGNAL·상태 유지.
  assert.equal(log.filter(({ event }) => event.type === 'lumen-pulse-hit').length, 9);
  assert.equal(reset.playerHp, PULSE_RULES.maxPlayerHp);
  assert.equal(reset.phaseIndex, 1);
  assert.equal(reset.phaseTick, 0);
  assert.equal(reset.hp, 150);
  assert.equal(reset.playerSignal, PULSE_RULES.startSignal);
  assert.equal(reset.status, 'active');
  // 리셋 다음 틱에는 단계 예고가 다시 나온다(창 계약 불변).
  const after = stepBroadcastProtocol(reset);
  assert.equal(after.events.some((event) => event.type === 'protocol-telegraph'), true);
});

test('reflect-shield 단계의 K 우선순위 — 윈드업 중엔 방어, 아니면 단계 진행', () => {
  // Given: reflect-shield의 단계 창 안(틱 40)에서 윈드업이 활성인 상태.
  const { state: windup } = runUntil(freshState(), (events) => (
    events.some((event) => event.type === 'lumen-pulse-windup')
  ));
  assert.equal(windup.definition.phases[windup.phaseIndex].id, 'reflect-shield');

  // When: 같은 창에서 K를 두 번 — 첫 번째는 윈드업 중, 두 번째는 윈드업 해소 뒤.
  const guarded = stepBroadcastProtocol(windup, { actions: [{ id: 'k-1', type: 'reflect' }] });
  const advanced = stepBroadcastProtocol(guarded.state, { actions: [{ id: 'k-2', type: 'reflect' }] });

  // Then: 첫 K는 방어로만 소비돼 단계가 그대로, 두 번째 K가 단계를 넘긴다.
  assert.equal(guarded.events.some((event) => event.type === 'lumen-pulse-blocked'), true);
  assert.equal(guarded.events.some((event) => event.type === 'protocol-mastered'), false);
  assert.equal(guarded.state.phaseIndex, 0);
  assert.equal(advanced.events.some((event) => event.type === 'protocol-mastered'), true);
  assert.equal(advanced.state.phaseIndex, 1);
});
