// 「모래시계 사구」 — 모래시계 항구의 나침반 도전. 순수 로직(THREE 무의존, node 테스트 가능).
// 규칙: 기울어진 모래시계들이 저마다의 주기로 흔들린다. 나침반으로 당기는 순간
// 똑바로 서 있으면(잠금 창 안) 그대로 굳고 모래가 다시 흐른다 — '멈출 때'를 아는 타이밍.
// 흔들림은 도전 시작부터의 누적 시간 t의 사인 함수 — 결정적(랜덤 0).

export const DUNES = {
  // 모래시계 좌표·주기 — isle.js가 이 데이터로 사구를 세운다(로직·표현 단일 출처).
  glasses: [
    { id: 'g1', x: -6.4, z: -3.2, omega: 0.9, scale: 1.25 },
    { id: 'g2', x: -8.6, z: 1.4, omega: 1.3, scale: 0.85 },
    { id: 'g3', x: -4.6, z: 2.8, omega: 1.7, scale: 0.7 }
  ],
  amplitude: 0.85, // 흔들림 최대 기울기(라디안)
  lockWindow: 0.18, // 잠금 성공 판정(|기울기| 라디안)
  pullRange: 2.6 // 당기기 인식 거리
};

export function createDunesState() {
  return {
    t: 0,
    locked: { g1: false, g2: false, g3: false },
    cleared: false
  };
}

export function tickDunes(state, dt) {
  if (!state.cleared) {
    state.t += dt;
  }
}

// 현재 기울기(라디안). 잠긴 모래시계는 똑바로(0).
export function glassAngle(state, glassId) {
  if (state.locked[glassId]) {
    return 0;
  }
  const index = DUNES.glasses.findIndex((glass) => glass.id === glassId);
  const glass = DUNES.glasses[index];
  return Math.sin(state.t * glass.omega + index * 1.3) * DUNES.amplitude;
}

// 플레이어 위치에서 당김 범위 안의 가장 가까운 (아직 안 잠긴) 모래시계.
export function nearestGlass(state, x, z, range = DUNES.pullRange) {
  let best = null;
  let bestDistance = range;
  for (const glass of DUNES.glasses) {
    if (state.locked[glass.id]) {
      continue;
    }
    const distance = Math.hypot(x - glass.x, z - glass.z);
    if (distance < bestDistance) {
      best = glass;
      bestDistance = distance;
    }
  }
  return best;
}

// 나침반 당기기. events: 'locked'(성공) | 'cleared'(전부 완성) | 'wobble'(타이밍 미스 — 벌점 없음)
export function pullGlass(state, glassId) {
  if (state.cleared || state.locked[glassId]) {
    return [];
  }
  if (Math.abs(glassAngle(state, glassId)) >= DUNES.lockWindow) {
    return ['wobble'];
  }
  state.locked[glassId] = true;
  const events = ['locked'];
  if (DUNES.glasses.every((glass) => state.locked[glass.id])) {
    state.cleared = true;
    events.push('cleared');
  }
  return events;
}
