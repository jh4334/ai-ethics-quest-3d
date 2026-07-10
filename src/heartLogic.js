// 「기억의 심장 외곽」 — 4봉인 동사 조합 훈련. 순수 로직(THREE 무의존, node 테스트 가능).
// 규칙: 네 개의 봉인석이 저마다의 주기로 빛난다(도전 누적 시간 t의 사인 — 결정적).
// 빛이 가장 환해진 순간(peakThreshold 이상) 그 봉인 앞에서 약속의 힘(F)을 쓰면 해제.
// 어두울 때 쓰면 벌점 없는 재시도 — 네 동사를 차례로 복습하는 심부 앞 훈련이다.

export const HEART = {
  // 봉인석 좌표·주기 — isle.js가 이 데이터로 봉인석을 세운다(로직·표현 단일 출처).
  seals: [
    { id: 'shield', emoji: '🛡️', nameKo: '약속의 방패', x: -5.2, z: -1.2, omega: 1.1 },
    { id: 'compass', emoji: '🧭', nameKo: '진실의 나침반', x: 5.8, z: -1.6, omega: 1.4 },
    { id: 'bell', emoji: '🔔', nameKo: '출처의 종', x: -3.8, z: -9.0, omega: 0.8 },
    { id: 'mirror', emoji: '🪞', nameKo: '다양성의 거울', x: 4.6, z: -9.2, omega: 0.65 }
  ],
  peakThreshold: 0.88, // 이 이상으로 차오른 순간에만 봉인이 풀린다 (0..1)
  useRange: 2.4 // 봉인석 인식 거리
};

export function createHeartState() {
  return {
    t: 0,
    released: { shield: false, compass: false, bell: false, mirror: false },
    cleared: false
  };
}

export function tickHeart(state, dt) {
  if (!state.cleared) {
    state.t += dt;
  }
}

// 봉인석의 현재 빛(0..1). 해제된 봉인은 항상 만개(1).
export function sealPulse(state, sealId) {
  if (state.released[sealId]) {
    return 1;
  }
  const index = HEART.seals.findIndex((seal) => seal.id === sealId);
  const seal = HEART.seals[index];
  return (Math.sin(state.t * seal.omega + index * 1.6) + 1) / 2;
}

// 플레이어 위치에서 사용 범위 안의 가장 가까운 (아직 안 풀린) 봉인석.
export function nearestSeal(state, x, z, range = HEART.useRange) {
  let best = null;
  let bestDistance = range;
  for (const seal of HEART.seals) {
    if (state.released[seal.id]) {
      continue;
    }
    const distance = Math.hypot(x - seal.x, z - seal.z);
    if (distance < bestDistance) {
      best = seal;
      bestDistance = distance;
    }
  }
  return best;
}

// 약속의 힘 사용. events: 'released'(해제) | 'cleared'(전부 해제) | 'dim'(아직 어두움 — 벌점 없음)
export function useSeal(state, sealId) {
  if (state.cleared || state.released[sealId]) {
    return [];
  }
  if (sealPulse(state, sealId) < HEART.peakThreshold) {
    return ['dim'];
  }
  state.released[sealId] = true;
  const events = ['released'];
  if (HEART.seals.every((seal) => state.released[seal.id])) {
    state.cleared = true;
    events.push('cleared');
  }
  return events;
}
