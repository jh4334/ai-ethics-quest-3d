// 「모래시계 사구」 순수 로직 — 흔들림·잠금 창·타이밍 미스·클리어·결정성.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DUNES, createDunesState, glassAngle, nearestGlass, pullGlass, tickDunes } from '../src/dunesLogic.js';

// 특정 모래시계가 잠금 창 안(똑바로)일 때의 t를 찾는다: sin(t·ω + i·1.3) = 0.
function uprightTime(glassId, k = 1) {
  const index = DUNES.glasses.findIndex((glass) => glass.id === glassId);
  return (Math.PI * k - index * 1.3) / DUNES.glasses[index].omega;
}

test('데이터 무결성: 모래시계 3개 id 중복 없음, 주기 전부 서로 다름', () => {
  assert.equal(DUNES.glasses.length, 3);
  assert.equal(new Set(DUNES.glasses.map((g) => g.id)).size, 3);
  assert.equal(new Set(DUNES.glasses.map((g) => g.omega)).size, 3);
});

test('흔들림: t에 따라 기울고, 잠긴 모래시계는 항상 똑바로(0)', () => {
  const state = createDunesState();
  state.t = uprightTime('g1') + Math.PI / (2 * DUNES.glasses[0].omega); // 최대 기울기 시점
  assert.ok(Math.abs(glassAngle(state, 'g1')) > DUNES.lockWindow);
  state.locked.g1 = true;
  assert.equal(glassAngle(state, 'g1'), 0);
});

test('타이밍 미스(wobble): 기울어 있을 때 당기면 잠기지 않는다 — 벌점 없음', () => {
  const state = createDunesState();
  state.t = uprightTime('g1') + Math.PI / (2 * DUNES.glasses[0].omega);
  assert.deepEqual(pullGlass(state, 'g1'), ['wobble']);
  assert.equal(state.locked.g1, false);
});

test('똑바로 선 순간 당기면 잠기고, 3개 모두 세우면 cleared', () => {
  const state = createDunesState();
  const order = ['g1', 'g2', 'g3'];
  order.forEach((glassId, i) => {
    state.t = uprightTime(glassId);
    const events = pullGlass(state, glassId);
    if (i < order.length - 1) {
      assert.deepEqual(events, ['locked']);
    } else {
      assert.deepEqual(events, ['locked', 'cleared']);
    }
  });
  assert.equal(state.cleared, true);
  // 클리어 후엔 시간이 멈춘다(연출 고정) + 추가 당김 무시.
  const t = state.t;
  tickDunes(state, 5);
  assert.equal(state.t, t);
  assert.deepEqual(pullGlass(state, 'g1'), []);
});

test('nearestGlass: 잠긴 모래시계는 대상에서 빠진다', () => {
  const state = createDunesState();
  const g1 = DUNES.glasses[0];
  assert.equal(nearestGlass(state, g1.x + 0.5, g1.z)?.id, 'g1');
  state.locked.g1 = true;
  assert.notEqual(nearestGlass(state, g1.x + 0.5, g1.z)?.id ?? null, 'g1');
  assert.equal(nearestGlass(state, 20, 20), null);
});

test('결정성: 같은 tick·당김 시퀀스는 같은 상태를 만든다', () => {
  const play = () => {
    const state = createDunesState();
    tickDunes(state, 1.2);
    pullGlass(state, 'g2');
    state.t = uprightTime('g3');
    pullGlass(state, 'g3');
    return state;
  };
  assert.deepEqual(play(), play());
});
