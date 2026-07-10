// 「기억의 심장 심부」 — 노이즈의 잔영 리매치. 순수 로직(THREE 무의존, node 테스트 가능).
// 서사: 처음엔 어떤 힘도 튕겨난다(패배 연출) → 정령들의 목소리가 진짜 힘을 깨움(각성)
// → 4껍질전: 페이즈마다 잔영이 그 동사의 색으로 '공격 자세'를 취한다(누적 시간 t의
// 사인 게이지 — 결정적). 게이지가 절정일 때 약속의 힘(F)을 쓰면 껍질이 깨진다.

export const RESIDUE = {
  boss: { x: 0.4, z: -4.5 }, // 잔영의 자리(아레나 중앙 북쪽)
  useRange: 6.5, // 힘 사용 인식 거리(아레나 전체를 넉넉히)
  deflectsToAwaken: 3, // 패배 연출: 이만큼 튕겨나면 정령들이 개입한다
  phases: [
    { toolId: 'shield', emoji: '🛡️', nameKo: '약속의 방패', omega: 1.2, color: 0x9fd8ff },
    { toolId: 'compass', emoji: '🧭', nameKo: '진실의 나침반', omega: 1.5, color: 0xffd88a },
    { toolId: 'bell', emoji: '🔔', nameKo: '출처의 종', omega: 0.9, color: 0xffb86a },
    { toolId: 'mirror', emoji: '🪞', nameKo: '다양성의 거울', omega: 0.7, color: 0xc8a8e8 }
  ],
  windupThreshold: 0.86 // 게이지가 이 이상일 때가 '공격 자세의 절정'
};

export function createResidueState() {
  return {
    stage: 'intro', // 'intro'(패배 연출) → 'fight'(4껍질전) → 'defeated'
    deflects: 0,
    phase: 0,
    t: 0
  };
}

// 패배 연출 중의 힘 사용 — 전부 튕겨난다. 정해진 횟수만큼 튕기면 각성.
// events: 'deflected' | 'awaken'
export function residueIntroHit(state) {
  if (state.stage !== 'intro') {
    return [];
  }
  state.deflects += 1;
  if (state.deflects >= RESIDUE.deflectsToAwaken) {
    state.stage = 'fight';
    state.t = 0;
    return ['deflected', 'awaken'];
  }
  return ['deflected'];
}

export function tickResidue(state, dt) {
  if (state.stage === 'fight') {
    state.t += dt;
  }
}

// 현재 페이즈의 공격 자세 게이지(0..1).
export function windupGauge(state) {
  if (state.stage !== 'fight') {
    return 0;
  }
  const phase = RESIDUE.phases[state.phase];
  return (Math.sin(state.t * phase.omega + state.phase * 1.1) + 1) / 2;
}

// 각성 후의 힘 사용. events: 'early'(아직 — 벌점 없음) | 'break'(껍질 파괴) | 'defeated'(격파)
export function strikeResidue(state) {
  if (state.stage !== 'fight') {
    return [];
  }
  if (windupGauge(state) < RESIDUE.windupThreshold) {
    return ['early'];
  }
  state.phase += 1;
  if (state.phase >= RESIDUE.phases.length) {
    state.stage = 'defeated';
    return ['break', 'defeated'];
  }
  return ['break'];
}
