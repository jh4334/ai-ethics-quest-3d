// 「소문의 벽」 순수 로직 — 울림 판별 창·blind 강제·라운드 진행·클리어·결정성.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RUMOR,
  chooseRumorStone,
  createRumorState,
  isEchoStone,
  nearestRumorStone,
  ringRumorBell,
  tickRumor
} from '../src/rumorLogic.js';

test('데이터 무결성: 돌 5개 id 중복 없음, 라운드 원본은 전부 실제 돌', () => {
  assert.equal(RUMOR.stones.length, 5);
  assert.equal(new Set(RUMOR.stones.map((s) => s.id)).size, 5);
  for (const originId of RUMOR.rounds) {
    assert.ok(RUMOR.stones.some((s) => s.id === originId), `깨진 라운드 원본: ${originId}`);
  }
});

test('울림 없이 고르면 평가하지 않는다(blind) — 출처 확인 습관 강제', () => {
  const state = createRumorState();
  assert.deepEqual(chooseRumorStone(state, RUMOR.rounds[0]), ['blind']);
  assert.equal(state.round, 0);
});

test('울림 → 판별 창이 열리고 시간이 지나면 닫힌다', () => {
  const state = createRumorState();
  ringRumorBell(state);
  assert.equal(state.revealT, RUMOR.revealTime);
  tickRumor(state, 1.0);
  assert.ok(state.revealT > 0);
  tickRumor(state, RUMOR.revealTime);
  assert.equal(state.revealT, 0);
  assert.deepEqual(chooseRumorStone(state, RUMOR.rounds[0]), ['blind']);
});

test('메아리 선택은 벌점 없는 재도전 — 판별 창은 유지', () => {
  const state = createRumorState();
  ringRumorBell(state);
  const echoId = RUMOR.stones.find((s) => isEchoStone(state, s.id)).id;
  assert.deepEqual(chooseRumorStone(state, echoId), ['wrong']);
  assert.equal(state.round, 0);
  assert.ok(state.revealT > 0);
});

test('원본 선택 → 라운드 진행 + 판별 창 초기화, 3라운드 완주 → cleared', () => {
  const state = createRumorState();
  for (let round = 0; round < RUMOR.rounds.length; round += 1) {
    ringRumorBell(state);
    const events = chooseRumorStone(state, RUMOR.rounds[round]);
    if (round < RUMOR.rounds.length - 1) {
      assert.deepEqual(events, ['correct']);
      assert.equal(state.revealT, 0); // 다음 라운드는 다시 울려야 한다
    } else {
      assert.deepEqual(events, ['correct', 'cleared']);
    }
  }
  assert.equal(state.cleared, true);
  // 클리어 후에는 아무 일도 없다.
  assert.deepEqual(chooseRumorStone(state, 's0'), []);
  ringRumorBell(state);
  assert.equal(state.revealT, 0);
});

test('nearestRumorStone: 범위 안 최근접, 밖이면 null', () => {
  const s3 = RUMOR.stones.find((s) => s.id === 's3');
  assert.equal(nearestRumorStone(s3.x + 0.5, s3.z)?.id, 's3');
  assert.equal(nearestRumorStone(-5, 5), null);
});

test('결정성: 같은 선택 시퀀스는 같은 상태를 만든다', () => {
  const play = () => {
    const state = createRumorState();
    ringRumorBell(state);
    chooseRumorStone(state, 's1'); // wrong
    chooseRumorStone(state, RUMOR.rounds[0]);
    ringRumorBell(state);
    tickRumor(state, 0.4);
    chooseRumorStone(state, RUMOR.rounds[1]);
    return state;
  };
  assert.deepEqual(play(), play());
});
