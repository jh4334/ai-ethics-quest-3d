// 「기억의 심장 외곽」 순수 로직 — 봉인 맥동·피크 타이밍·해제·클리어·결정성.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEART, createHeartState, nearestSeal, sealPulse, tickHeart, useSeal } from '../src/heartLogic.js';

// 봉인 i의 빛이 만개(1)하는 t: sin(t·ω + i·1.6) = 1.
function peakTime(sealId, k = 0) {
  const index = HEART.seals.findIndex((seal) => seal.id === sealId);
  return (Math.PI / 2 - index * 1.6 + 2 * Math.PI * (k + 1)) / HEART.seals[index].omega;
}

test('데이터 무결성: 봉인 4개 = 도구 4종, 주기 전부 서로 다름', () => {
  assert.deepEqual(
    HEART.seals.map((seal) => seal.id).sort(),
    ['bell', 'compass', 'mirror', 'shield']
  );
  assert.equal(new Set(HEART.seals.map((seal) => seal.omega)).size, 4);
});

test('어두운 순간의 힘 사용은 dim — 벌점 없이 재시도', () => {
  const state = createHeartState();
  const index = HEART.seals.findIndex((seal) => seal.id === 'shield');
  // 빛이 완전히 꺼지는 t: sin = -1.
  state.t = (-Math.PI / 2 - index * 1.6 + 2 * Math.PI * 2) / HEART.seals[index].omega;
  assert.ok(sealPulse(state, 'shield') < 0.1);
  assert.deepEqual(useSeal(state, 'shield'), ['dim']);
  assert.equal(state.released.shield, false);
});

test('빛이 만개한 순간 사용하면 해제, 4개 모두 풀면 cleared', () => {
  const state = createHeartState();
  const order = HEART.seals.map((seal) => seal.id);
  order.forEach((sealId, i) => {
    state.t = peakTime(sealId);
    assert.ok(sealPulse(state, sealId) >= HEART.peakThreshold);
    const events = useSeal(state, sealId);
    if (i < order.length - 1) {
      assert.deepEqual(events, ['released']);
    } else {
      assert.deepEqual(events, ['released', 'cleared']);
    }
  });
  assert.equal(state.cleared, true);
  // 해제된 봉인은 항상 만개 + 추가 사용 무시 + 시간 정지.
  assert.equal(sealPulse(state, 'shield'), 1);
  assert.deepEqual(useSeal(state, 'bell'), []);
  const t = state.t;
  tickHeart(state, 3);
  assert.equal(state.t, t);
});

test('nearestSeal: 해제된 봉인은 대상에서 빠지고, 범위 밖이면 null', () => {
  const state = createHeartState();
  const shield = HEART.seals.find((seal) => seal.id === 'shield');
  assert.equal(nearestSeal(state, shield.x + 0.5, shield.z)?.id, 'shield');
  state.released.shield = true;
  assert.notEqual(nearestSeal(state, shield.x + 0.5, shield.z)?.id ?? null, 'shield');
  assert.equal(nearestSeal(state, 30, 30), null);
});

test('결정성: 같은 tick·사용 시퀀스는 같은 상태를 만든다', () => {
  const play = () => {
    const state = createHeartState();
    tickHeart(state, 0.8);
    useSeal(state, 'compass');
    state.t = peakTime('mirror');
    useSeal(state, 'mirror');
    return state;
  };
  assert.deepEqual(play(), play());
});
