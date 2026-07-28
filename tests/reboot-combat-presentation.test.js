import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCombatFrame,
  createCombatPresentationAdapter
} from '../src/reboot/render/combatPresentation.js';
import { createCombatState } from '../src/reboot/sim/combatSimulation.js';

function presentationState() {
  const state = createCombatState({
    hp: 82,
    targets: [{ id: 'eraser', position: { x: 2, y: -1 }, hp: 64 }]
  });
  state.tick = 12;
  state.chain = { points: 3, level: 2 };
  state.player.position = { x: 1, y: 4 };
  state.player.facing = { x: 0, y: -1 };
  state.player.action = {
    name: 'reflect', instanceId: 7, elapsed: 3, hitTargets: [], targetId: null
  };
  state.targets[0].staggerTicks = 2;
  state.targets[0].traced = true;
  return state;
}

test('Given authoritative combat state, When a frame is built, Then it exposes Three-ready actors without resolving damage', () => {
  // Given: 피해 판정이 끝난 시뮬레이션 상태와 모든 핵심 표현 이벤트.
  const state = presentationState();
  const before = structuredClone(state);
  const events = [
    { type: 'action-started', action: 'reflect', instanceId: 7, tick: 12 },
    { type: 'target-hit', targetId: 'eraser', hitId: '7:eraser', damage: 12, hp: 5, tick: 12 },
    { type: 'player-hit', contactId: 'stamp-1', damage: 18, hp: 1, tick: 12 },
    { type: 'perfect-reflect', contactId: 'stamp-2', hitId: '7:stamp-2', tick: 12 },
    { type: 'traced', targetId: 'eraser', tick: 12 },
    { type: 'secured', targetId: 'eraser', tick: 12 },
    { type: 'chain-raised', level: 2, reason: 'secured', tick: 12 }
  ];

  // When: 순수 프레임 변환을 한 번 수행한다.
  const frame = buildCombatFrame(state, events);

  // Then: 좌표·애니메이션·HUD·큐만 만들고 HP와 입력 상태는 바꾸지 않는다.
  assert.deepEqual(frame.player.position, { x: 1, y: 0, z: 4 });
  assert.deepEqual(frame.targets[0].position, { x: 2, y: 0, z: -1 });
  assert.equal(frame.player.hp, 82);
  assert.equal(frame.targets[0].hp, 64);
  assert.equal(frame.player.animation, 'action');
  assert.equal(frame.targets[0].animation, 'hit');
  assert.deepEqual(frame.hud, {
    hp: 82, status: 'active', action: 'reflect', chainPoints: 3, chainLevel: 2,
    paused: false,
    cues: ['REFLECT', '대상 피해 12', '피해 18', '완벽 반사', 'TRACE 완료', 'SECURE 완료', 'SYNC CHAIN 2']
  });
  assert.deepEqual(frame.effects.map((effect) => effect.kind), [
    'action', 'target-hit', 'player-hit', 'perfect-reflect', 'trace', 'secure', 'chain'
  ]);
  assert.deepEqual(state, before);
});

test('Given repeated transient events, When frames are presented, Then each event is emitted once until reset', () => {
  // Given: 같은 반사 이벤트를 재전달할 수 있는 표현 어댑터.
  const adapter = createCombatPresentationAdapter();
  const state = presentationState();
  const event = { type: 'reflected', contactId: 'stamp-1', hitId: '7:stamp-1', tick: 12 };

  // When: 같은 이벤트를 두 프레임에 연속 전달한다.
  const first = adapter.present(state, [event]);
  const repeated = adapter.present(state, [event]);

  // Then: 첫 프레임만 일회성 큐를 내보낸다.
  assert.equal(first.effects.length, 1);
  assert.equal(first.hud.cues[0], '반사 성공');
  assert.equal(repeated.effects.length, 0);
  assert.equal(repeated.hud.cues.length, 0);

  // When: 장면 수명주기가 명시적으로 초기화된다.
  adapter.reset();
  const afterReset = adapter.present(state, [event]);

  // Then: 새 전투에서는 같은 식별자의 큐도 다시 표현할 수 있다.
  assert.equal(afterReset.effects.length, 1);
});

test('Given pause and restart boundaries, When presentation resumes at an earlier tick, Then stale cues stay cleared and dedupe resets', () => {
  // Given: 이미 처리한 TRACE 이벤트와 일시정지 상태.
  const adapter = createCombatPresentationAdapter();
  const state = presentationState();
  const event = { type: 'traced', targetId: 'eraser', tick: 12 };
  adapter.present(state, [event]);
  const paused = structuredClone(state);
  paused.paused = true;

  // When: 정지 중 이벤트가 들어오고, 이후 tick 0의 새 전투가 시작된다.
  const held = adapter.present(paused, [event]);
  const restarted = presentationState();
  restarted.tick = 0;
  const firstRestartFrame = adapter.present(restarted, [{ ...event, tick: 0 }]);

  // Then: 정지 화면에는 transient가 없고 재시작 이벤트는 다시 한 번 표현된다.
  assert.equal(held.effects.length, 0);
  assert.equal(held.hud.paused, true);
  assert.equal(firstRestartFrame.effects.length, 1);
  assert.equal(firstRestartFrame.hud.cues[0], 'TRACE 완료');
});

test('Given malformed and excessive events, When presented, Then unknown cues are ignored and transient memory stays bounded', () => {
  // Given: 작은 dedupe 상한과 알 수 없는 이벤트를 포함한 입력.
  const adapter = createCombatPresentationAdapter({ maxRememberedEvents: 4 });
  const state = presentationState();
  const events = [
    null,
    { type: 'unknown', tick: 12 },
    ...Array.from({ length: 12 }, (_, index) => ({
      type: 'action-started', action: 'attack1', instanceId: index + 1, tick: index + 1
    }))
  ];

  // When: 모든 이벤트를 한 프레임에서 변환한다.
  const frame = adapter.present(state, events);

  // Then: 알려진 큐만 표현하고 기억 크기는 고정 상한을 넘지 않는다.
  assert.equal(frame.effects.length, 12);
  assert.equal(adapter.retainedEventCount(), 4);
  assert.ok(frame.effects.every((effect) => effect.kind === 'action'));
});
