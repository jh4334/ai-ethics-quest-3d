// 「기억의 심장 심부」 순수 로직 — 패배 연출·각성·게이지·껍질 파괴·격파·결정성.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RESIDUE, createResidueState, residueIntroHit, strikeResidue, tickResidue, windupGauge } from '../src/residueLogic.js';

// 페이즈 i의 게이지가 만개(1)하는 t: sin(t·ω + i·1.1) = 1.
function peakTime(phaseIndex, k = 1) {
  const phase = RESIDUE.phases[phaseIndex];
  return (Math.PI / 2 - phaseIndex * 1.1 + 2 * Math.PI * k) / phase.omega;
}

test('데이터 무결성: 페이즈 4개 = 도구 4종(방패→나침반→종→거울)', () => {
  assert.deepEqual(
    RESIDUE.phases.map((phase) => phase.toolId),
    ['shield', 'compass', 'bell', 'mirror']
  );
  assert.equal(new Set(RESIDUE.phases.map((phase) => phase.omega)).size, 4);
});

test('패배 연출: 힘이 전부 튕겨나고, 정해진 횟수째에 각성한다', () => {
  const state = createResidueState();
  for (let i = 0; i < RESIDUE.deflectsToAwaken - 1; i += 1) {
    assert.deepEqual(residueIntroHit(state), ['deflected']);
    assert.equal(state.stage, 'intro');
  }
  assert.deepEqual(residueIntroHit(state), ['deflected', 'awaken']);
  assert.equal(state.stage, 'fight');
  // 각성 후엔 intro 훅이 아무 일도 하지 않는다.
  assert.deepEqual(residueIntroHit(state), []);
});

test('intro 단계에선 시간이 흐르지 않고 strike도 무시된다', () => {
  const state = createResidueState();
  tickResidue(state, 3);
  assert.equal(state.t, 0);
  assert.equal(windupGauge(state), 0);
  assert.deepEqual(strikeResidue(state), []);
});

test('각성 후: 게이지가 낮을 때는 early, 절정일 때 껍질이 깨진다', () => {
  const state = createResidueState();
  state.stage = 'fight';
  // 게이지 최저점(sin = -1).
  state.t = (-Math.PI / 2 - 0 * 1.1 + 2 * Math.PI * 2) / RESIDUE.phases[0].omega;
  assert.ok(windupGauge(state) < 0.1);
  assert.deepEqual(strikeResidue(state), ['early']);
  assert.equal(state.phase, 0);
  state.t = peakTime(0);
  assert.ok(windupGauge(state) >= RESIDUE.windupThreshold);
  assert.deepEqual(strikeResidue(state), ['break']);
  assert.equal(state.phase, 1);
});

test('4껍질을 모두 깨면 defeated — 이후 모든 입력 무시', () => {
  const state = createResidueState();
  state.stage = 'fight';
  for (let phase = 0; phase < RESIDUE.phases.length; phase += 1) {
    state.t = peakTime(phase);
    const events = strikeResidue(state);
    if (phase < RESIDUE.phases.length - 1) {
      assert.deepEqual(events, ['break']);
    } else {
      assert.deepEqual(events, ['break', 'defeated']);
    }
  }
  assert.equal(state.stage, 'defeated');
  assert.deepEqual(strikeResidue(state), []);
  const t = state.t;
  tickResidue(state, 2);
  assert.equal(state.t, t);
});

test('결정성: 같은 시퀀스는 같은 상태를 만든다', () => {
  const play = () => {
    const state = createResidueState();
    residueIntroHit(state);
    residueIntroHit(state);
    residueIntroHit(state);
    tickResidue(state, 0.7);
    strikeResidue(state);
    state.t = peakTime(0);
    strikeResidue(state);
    return state;
  };
  assert.deepEqual(play(), play());
});
