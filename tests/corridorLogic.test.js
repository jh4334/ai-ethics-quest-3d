// 「말-화살 회랑」 순수 로직 — 발사·가드 반사·놓침·클리어·결정성.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORRIDOR, createCorridorState, stepCorridor } from '../src/corridorLogic.js';

const PLAYER = { x: 0.4, z: -2.0 };
const DT = 1 / 60;

// dt를 잘게 나눠 진행하며 모든 사건을 수집한다.
function run(state, seconds, player, guardActive) {
  const events = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    events.push(...stepCorridor(state, DT, player, guardActive));
  }
  return events;
}

test('시작 상태: 발사대 3개 건재, 대기 후 첫 발사대가 쏜다', () => {
  const state = createCorridorState();
  assert.deepEqual(Object.values(state.broken), [false, false, false]);
  const events = run(state, CORRIDOR.fireDelay + 0.1, PLAYER, false);
  assert.deepEqual(events, ['fired']);
  assert.equal(state.arrow.emitterId, 'e1');
});

test('가드 없이 두면 화살이 플레이어를 스치고(hit) 재장전된다', () => {
  const state = createCorridorState();
  const events = run(state, 8, PLAYER, false);
  assert.ok(events.includes('hit'));
  assert.equal(state.cleared, false);
  assert.deepEqual(Object.values(state.broken), [false, false, false]);
});

test('가드 반사: 화살이 주인에게 돌아가 발사대를 부순다', () => {
  const state = createCorridorState();
  const events = run(state, 8, PLAYER, true); // 항상 가드 자세(테스트 전용)
  assert.ok(events.includes('deflected'));
  assert.ok(events.includes('broken'));
  assert.equal(state.broken.e1, true);
});

test('완벽 반사(숙련 보상): 마지막 순간(perfectRange 안)에 되받으면 deflected-perfect', () => {
  // 가드를 항상 켜면 deflectRange(1.35)에서 바로 되받아 일반 'deflected'가 난다.
  const early = createCorridorState();
  const earlyEvents = run(early, 8, PLAYER, true);
  assert.ok(earlyEvents.includes('deflected'));
  assert.ok(!earlyEvents.includes('deflected-perfect'), '넉넉한 거리 반사는 완벽이 아니다');

  // 화살이 perfectRange(0.78) 안에 들어왔을 때만 가드 → 완벽 반사.
  const late = createCorridorState();
  const events = [];
  for (let i = 0; i < Math.round(8 / DT); i += 1) {
    const arrow = late.arrow;
    const dist = arrow ? Math.hypot(arrow.x - PLAYER.x, arrow.z - PLAYER.z) : Infinity;
    const guardNow = dist < CORRIDOR.perfectRange;
    events.push(...stepCorridor(late, DT, PLAYER, guardNow));
    if (events.includes('deflected-perfect')) break;
  }
  assert.ok(events.includes('deflected-perfect'), '마지막 순간 반사는 완벽');
});

test('세 발사대를 모두 부수면 cleared', () => {
  const state = createCorridorState();
  const events = run(state, 40, PLAYER, true);
  assert.equal(events.filter((event) => event === 'broken').length, 3);
  assert.ok(events.includes('cleared'));
  assert.equal(state.cleared, true);
  // 클리어 후에는 아무 일도 일어나지 않는다.
  assert.deepEqual(stepCorridor(state, 1, PLAYER, true), []);
});

test('플레이어가 자리를 비우면 화살은 빗나가고(missed) 다시 장전된다', () => {
  const state = createCorridorState();
  run(state, CORRIDOR.fireDelay + 0.1, PLAYER, false); // 발사
  // 발사 후 플레이어가 반대편으로 이동 — 화살은 옛 위치를 지나쳐 바다로.
  const events = run(state, 8, { x: -9, z: 9 }, false);
  assert.ok(events.includes('missed'));
  // 빗나간 뒤에도 포기하지 않고 다시 쏜다(재장전 확인).
  assert.ok(events.indexOf('fired', events.indexOf('missed')) > events.indexOf('missed'));
  assert.deepEqual(Object.values(state.broken), [false, false, false]);
});

test('결정성: 같은 입력 시퀀스는 같은 사건 시퀀스를 만든다', () => {
  const a = createCorridorState();
  const b = createCorridorState();
  const eventsA = run(a, 20, PLAYER, true);
  const eventsB = run(b, 20, PLAYER, true);
  assert.deepEqual(eventsA, eventsB);
  assert.deepEqual(a, b);
});
