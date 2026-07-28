import assert from 'node:assert/strict';
import test from 'node:test';

import { ATTENDANCE_PROCTOR } from '../src/reboot/content/bosses/attendanceProctor.js';
import { validateBossDefinition } from '../src/reboot/content/bosses/validateBoss.js';
import { BOSS_FIXTURE_IDS, createBossFixture } from '../src/reboot/bosses/fixtures.js';
import { replayBossAtRate } from '../src/reboot/bosses/replay.js';
import { resolveBossVictory } from '../src/reboot/bosses/rewards.js';
import { createBossState, resetBossState, stepBoss } from '../src/reboot/bosses/runtime.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

function advanceToWindow(state) {
  const phase = state.definition.phases[state.phaseIndex];
  let current = state;
  while (current.phaseTick < phase.timing.windupTicks) current = stepBoss(current).state;
  return current;
}

function succeedCurrentWindow(state, id) {
  const phase = state.definition.phases[state.phaseIndex];
  const pattern = phase.patterns[state.cycleIndex % phase.patterns.length];
  const actions = {
    'reflect-scan': { id, type: 'reflect' },
    'trace-roster': { id, targetId: pattern.trueTargetId, type: 'trace' },
    'approval-core': { id, targetId: 'approval-core', type: 'attack' }
  };
  return stepBoss(advanceToWindow(state), { actions: [actions[phase.id]] });
}

test('Attendance Proctor definition is immutable and passes fairness validation', () => {
  // Given: 세 가지 숙련 동사를 요구하는 출석 감독관 정의다.
  const phaseIds = ATTENDANCE_PROCTOR.phases.map((phase) => phase.id);

  // When: 콘텐츠 경계 검증을 실행한다.
  const validation = validateBossDefinition(ATTENDANCE_PROCTOR);

  // Then: 정의는 고정되어 있고 모든 공격에 충분한 텔레그래프가 있다.
  assert.deepEqual(phaseIds, ['reflect-scan', 'trace-roster', 'approval-core']);
  assert.equal(validation.valid, true);
  assert.equal(Object.isFrozen(ATTENDANCE_PROCTOR.phases), true);
  assert.equal(ATTENDANCE_PROCTOR.phases.every((phase) => phase.timing.windupTicks >= 18), true);
});

test('boss validation rejects short telegraphs and collision-changing erasure', () => {
  // Given: 경고 시간이 없고 안전지대 충돌을 지우는 변조된 정의다.
  const unsafe = structuredClone(ATTENDANCE_PROCTOR);
  unsafe.phases[0].timing.windupTicks = 2;
  unsafe.phases[2].patterns[0].collisionChanged = true;

  // When: 변조된 정의를 검증한다.
  const validation = validateBossDefinition(unsafe);

  // Then: 두 공정성 위반을 각각 보고한다.
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors.map((error) => error.code).sort(), [
    'COLLISION_CHANGING_ERASURE',
    'SHORT_TELEGRAPH'
  ]);
});

test('mastery actions advance three phases and reveal the signature only after victory', () => {
  // Given: SECURE 결과를 가지고 보스전을 시작한다.
  let state = createBossState(ATTENDANCE_PROCTOR, { consequencePath: 'secure' });
  const events = [];

  // When: 빔 반사 2회, 진짜 ID TRACE 2회, 코어 타격 3회를 성공한다.
  for (let success = 0; success < 7; success += 1) {
    const result = succeedCurrentWindow(state, `mastery-${success}`);
    state = result.state;
    events.push(...result.events);
  }

  // Then: 체력 스펀지 없이 승리하고 승인 ID는 마지막 성공 뒤에만 공개된다.
  assert.equal(state.status, 'victory');
  assert.equal(state.hp, 0);
  assert.equal(events.filter((event) => event.type === 'mastery-success').length, 7);
  const revealIndex = events.findIndex((event) => event.type === 'signature-revealed');
  assert.ok(revealIndex > 0);
  assert.equal(events.slice(0, revealIndex).some((event) => 'signature' in event), false);
  assert.equal(events[revealIndex].signature, 'H-17');
  assert.match(events[revealIndex].callout, /원본/);
});

test('TRACE on a clone consumes no phase progress and identifies the decoy', () => {
  // Given: 두 번째 페이즈의 TRACE 창과 가짜 승인 ID가 있다.
  const fixture = createBossFixture('phase-2-window');
  const pattern = fixture.definition.phases[1].patterns[fixture.cycleIndex];

  // When: 진짜 ID가 아닌 첫 분신을 TRACE한다.
  const result = stepBoss(fixture, {
    actions: [{ id: 'wrong-trace', targetId: pattern.targetIds[0], type: 'trace' }]
  });

  // Then: 페이즈 진행은 유지되고 분신 피드백만 발생한다.
  assert.equal(result.state.phaseSuccesses, 0);
  assert.equal(result.events.some((event) => event.type === 'clone-decoy'), true);
});

test('approval-core erasure always leaves safe ground and never changes vertical collision', () => {
  // Given: 세 번째 페이즈의 첫 소거 패턴이 시작된다.
  const fixture = createBossFixture('phase-3-start');

  // When: 텔레그래프와 활성 시작까지 진행한다.
  const telegraph = stepBoss(fixture);
  let state = telegraph.state;
  let active;
  while (!active) {
    const result = stepBoss(state);
    state = result.state;
    active = result.events.find((event) => event.type === 'ground-erasure-visual');
  }

  // Then: 두 안전 구역이 남고 지형 충돌은 그대로다.
  assert.equal(telegraph.events[0].type, 'boss-telegraph');
  assert.ok(active.safeSectors.length >= 2);
  assert.equal(active.collisionChanged, false);
  assert.equal('damage' in active, false);
});

test('defeat retries within two seconds while preserving learned patterns', () => {
  // Given: 반사 패턴을 발견한 상태에서 플레이어 체력이 소진된다.
  let state = createBossFixture('phase-2-start');
  state = stepBoss(state, { playerHp: 0 }).state;

  // When: 자동 재시작 타이머를 진행한다.
  let elapsed = 0;
  let retryEvents = [];
  while (state.status === 'defeated' && elapsed <= 120) {
    const result = stepBoss(state);
    state = result.state;
    retryEvents = result.events;
    elapsed += 1;
  }

  // Then: 입장 연출은 생략되고 보스만 초기화되며 학습 정보는 남는다.
  assert.ok(elapsed <= 120);
  assert.equal(state.status, 'active');
  assert.equal(state.phaseIndex, 0);
  assert.equal(state.hp, ATTENDANCE_PROCTOR.maxHp);
  assert.equal(state.introSeen, true);
  assert.deepEqual(state.knowledge, ['reflect-scan']);
  assert.deepEqual(state.processedActionIds, []);
  assert.equal(retryEvents.some((event) => event.type === 'boss-retry-ready'), true);
});

test('reset is clean and does not share mutable boss state', () => {
  // Given: 서로 독립된 보스 인스턴스와 한 번 진행된 인스턴스가 있다.
  const first = createBossState();
  const second = createBossState();
  const advanced = stepBoss(first).state;

  // When: 진행된 인스턴스를 직접 재설정한다.
  const reset = resetBossState(advanced);

  // Then: 다른 인스턴스와 콘텐츠 정의를 오염시키지 않는다.
  assert.equal(second.tick, 0);
  assert.equal(reset.phaseTick, 0);
  assert.notEqual(reset, first);
  assert.equal(Object.isFrozen(reset), true);
  assert.equal(ATTENDANCE_PROCTOR.phases[0].timing.windupTicks, 24);
});

test('all required deterministic boss fixtures are available', () => {
  // Given: Task 8의 직접 진입 시나리오 목록이다.
  const required = [
    'phase-1-start', 'phase-1-window', 'phase-2-start', 'phase-2-window',
    'phase-3-start', 'phase-3-window', 'low-health', 'stagger', 'victory',
    'death-retry', 'purge-path', 'secure-path'
  ];

  // When: 모든 fixture를 생성한다.
  const fixtures = required.map((id) => createBossFixture(id));

  // Then: ID가 등록되어 있고 매번 동결된 새 상태를 반환한다.
  assert.deepEqual(BOSS_FIXTURE_IDS, required);
  assert.equal(fixtures.every(Object.isFrozen), true);
  assert.notEqual(createBossFixture('phase-1-start'), createBossFixture('phase-1-start'));
});

test('the same input log produces identical phase and action logs at 30 60 and 120Hz', () => {
  // Given: 일곱 숙련 입력이 고정 tick에 기록되어 있다.
  const inputLog = [
    { tick: 24, action: { id: 'r1', type: 'reflect' } },
    { tick: 49, action: { id: 'r2', type: 'reflect' } },
    { tick: 70, action: { id: 't1', targetId: 'approval-h17', type: 'trace' } },
    { tick: 91, action: { id: 't2', targetId: 'approval-h17', type: 'trace' } },
    { tick: 116, action: { id: 'a1', targetId: 'approval-core', type: 'attack' } },
    { tick: 141, action: { id: 'a2', targetId: 'approval-core', type: 'attack' } },
    { tick: 166, action: { id: 'a3', targetId: 'approval-core', type: 'attack' } }
  ];

  // When: 같은 180 tick을 서로 다른 렌더 주기로 재생한다.
  const logs = [30, 60, 120].map((renderHz) => replayBossAtRate({ inputLog, renderHz, totalTicks: 180 }));

  // Then: 페이즈·행동 로그와 최종 상태가 완전히 같다.
  assert.deepEqual(logs[0], logs[1]);
  assert.deepEqual(logs[1], logs[2]);
  assert.equal(logs[0].status, 'victory');
});

test('victory resolution awards evidence PATCH and chapter completion exactly once', () => {
  // Given: 승리 fixture와 변경되지 않은 v4 저장 상태다.
  const initial = createInitialRebootState();
  const victory = createBossFixture('victory');

  // When: 같은 승리를 두 번 확정한다.
  const first = resolveBossVictory(initial, victory, 'reflect-arc');
  const second = resolveBossVictory(first.state, victory, 'reflect-arc');

  // Then: 원본은 불변이고 보상·승인 증거·장 완료는 한 번만 기록된다.
  assert.equal(initial.patchChoice, null);
  assert.equal(first.state.patchChoice, 'reflect-arc');
  assert.deepEqual(first.state.chapterProgress, {
    completed: [1], current: 2, checkpoint: 'chapter-2:start'
  });
  assert.equal(first.state.evidence.filter((entry) => entry.evidenceId === 'player-approval-record').length, 1);
  assert.deepEqual(first.events.map((event) => event.type), [
    'patch-awarded', 'chapter-completed'
  ]);
  assert.equal(second.state, first.state);
  assert.deepEqual(second.events, []);
});

test('a repeated action id cannot duplicate mastery progress', () => {
  // Given: 첫 반사 성공 입력과 다음 반사 창이다.
  const first = succeedCurrentWindow(createBossFixture('phase-1-start'), 'same-action');
  const nextWindow = advanceToWindow(first.state);

  // When: 같은 입력 ID를 다시 보낸다.
  const repeated = stepBoss(nextWindow, { actions: [{ id: 'same-action', type: 'reflect' }] });

  // Then: 성공 횟수와 페이즈가 중복 증가하지 않는다.
  assert.equal(repeated.state.phaseSuccesses, 1);
  assert.equal(repeated.state.phaseIndex, 0);
  assert.equal(repeated.events.some((event) => event.type === 'mastery-success'), false);
});
