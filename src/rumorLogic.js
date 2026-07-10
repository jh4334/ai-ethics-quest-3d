// 「소문의 벽」 — 메아리 동굴의 출처의 종 도전. 순수 로직(THREE 무의존, node 테스트 가능).
// 규칙: 웅얼돌 다섯 개가 같은 소문을 되풀이한다. 종을 울리면 잠깐 동안 메아리 돌은 떨리고
// 원본(출처) 돌만 굳건하다 — 그 창 안에 원본을 고르면 라운드 통과. 3라운드(원본 고정
// 시퀀스, 교실 재현성) 모두 맞히면 소문이 흩어진다.
// 울림 없이 고르면 평가하지 않는다('blind') — 출처 확인은 도구(검증)로 하는 습관을 강제한다.

export const RUMOR = {
  // 웅얼돌 좌표 — isle.js가 이 좌표로 돌을 세운다(로직·표현 단일 출처).
  stones: [
    { id: 's0', x: 4.97, z: -3.6 },
    { id: 's1', x: 4.83, z: -2.1 },
    { id: 's2', x: 4.8, z: -0.6 },
    { id: 's3', x: 4.88, z: 0.9 },
    { id: 's4', x: 5.06, z: 2.4 }
  ],
  rounds: ['s3', 's0', 's2'], // 라운드별 원본 돌(고정)
  revealTime: 2.6, // 종 울림 뒤 판별 창(초)
  chooseRange: 2.0 // 돌 선택 인식 거리
};

export function createRumorState() {
  return { round: 0, revealT: 0, cleared: false };
}

export function ringRumorBell(state) {
  if (!state.cleared) {
    state.revealT = RUMOR.revealTime;
  }
}

export function tickRumor(state, dt) {
  if (state.revealT > 0) {
    state.revealT = Math.max(0, state.revealT - dt);
  }
}

// 이 돌이 현재 라운드의 메아리(가짜)인가.
export function isEchoStone(state, stoneId) {
  return stoneId !== RUMOR.rounds[state.round];
}

// 플레이어 위치에서 선택 범위 안의 가장 가까운 돌.
export function nearestRumorStone(x, z, range = RUMOR.chooseRange) {
  let best = null;
  let bestDistance = range;
  for (const stone of RUMOR.stones) {
    const distance = Math.hypot(x - stone.x, z - stone.z);
    if (distance < bestDistance) {
      best = stone;
      bestDistance = distance;
    }
  }
  return best;
}

// 돌 선택. events: 'blind'(울림 없이 선택 — 평가 안 함) | 'wrong' | 'correct' | 'cleared'
export function chooseRumorStone(state, stoneId) {
  if (state.cleared) {
    return [];
  }
  if (state.revealT <= 0) {
    return ['blind'];
  }
  if (isEchoStone(state, stoneId)) {
    // 벌점 없는 재도전 — 판별 창은 유지된다(바로 다시 고를 수 있게).
    return ['wrong'];
  }
  state.round += 1;
  state.revealT = 0; // 다음 라운드는 다시 울려서 살펴야 한다
  if (state.round >= RUMOR.rounds.length) {
    state.cleared = true;
    return ['correct', 'cleared'];
  }
  return ['correct'];
}
