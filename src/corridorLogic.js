// 「말-화살 회랑」 — 속삭임 곶의 방패 동사 도전. 순수 로직(THREE 무의존, node 테스트 가능).
// 결정성: 발사 순서(항상 살아있는 첫 발사대)·간격·속도 전부 상수.
// 화살은 발사 순간의 플레이어 위치를 향해 직선 비행 — 가드로 튕기면 왔던 길을 되돌아가 주인을 부순다.

export const CORRIDOR = {
  // 발사대(절벽의 잡음 소용돌이) — isle 씬 월드 좌표.
  emitters: [
    { id: 'e1', x: -3.4, z: -8.0 },
    { id: 'e2', x: 0.2, z: -9.2 },
    { id: 'e3', x: 3.8, z: -7.6 }
  ],
  fireDelay: 1.6, // 도전 시작·재장전 대기(초)
  arrowSpeed: 6.0, // 화살 속도(유닛/초)
  deflectRange: 1.35, // 가드 성공 판정 거리
  perfectRange: 0.78, // 이보다 가까이서 되받으면 '완벽 반사'(마지막 순간 타이밍 — 숙련 보상)
  hitRange: 0.6, // 놓침(스침) 판정 거리
  fieldRadius: 22 // 이 밖으로 날아간 화살은 빗나감 처리
};

export function createCorridorState() {
  return {
    broken: { e1: false, e2: false, e3: false },
    arrow: null, // { emitterId, x, z, dx, dz, returning }
    fireTimer: CORRIDOR.fireDelay,
    cleared: false
  };
}

function nextEmitter(state) {
  return CORRIDOR.emitters.find((emitter) => !state.broken[emitter.id]) ?? null;
}

function resetArrow(state) {
  state.arrow = null;
  state.fireTimer = CORRIDOR.fireDelay;
}

// dt만큼 시뮬레이션을 진행하고 발생한 사건 목록을 돌려준다.
// player: {x, z}, guardActive: 방패 가드 자세 여부.
// events: 'fired' | 'deflected' | 'broken' | 'cleared' | 'hit' | 'missed'
export function stepCorridor(state, dt, player, guardActive) {
  const events = [];
  if (state.cleared) {
    return events;
  }

  if (!state.arrow) {
    state.fireTimer -= dt;
    if (state.fireTimer <= 0) {
      const emitter = nextEmitter(state);
      if (!emitter) {
        return events;
      }
      const length = Math.hypot(player.x - emitter.x, player.z - emitter.z) || 1;
      state.arrow = {
        emitterId: emitter.id,
        x: emitter.x,
        z: emitter.z,
        dx: (player.x - emitter.x) / length,
        dz: (player.z - emitter.z) / length,
        returning: false
      };
      events.push('fired');
    }
    return events;
  }

  const arrow = state.arrow;
  arrow.x += arrow.dx * CORRIDOR.arrowSpeed * dt;
  arrow.z += arrow.dz * CORRIDOR.arrowSpeed * dt;

  if (arrow.returning) {
    const emitter = CORRIDOR.emitters.find((item) => item.id === arrow.emitterId);
    if (Math.hypot(arrow.x - emitter.x, arrow.z - emitter.z) < 0.7) {
      state.broken[arrow.emitterId] = true;
      resetArrow(state);
      events.push('broken');
      if (!nextEmitter(state)) {
        state.cleared = true;
        events.push('cleared');
      }
    }
    return events;
  }

  const playerDistance = Math.hypot(arrow.x - player.x, arrow.z - player.z);
  if (guardActive && playerDistance < CORRIDOR.deflectRange) {
    // 방패에 맞은 화살은 왔던 길을 그대로 되돌아간다 — 주인에게.
    arrow.returning = true;
    arrow.dx = -arrow.dx;
    arrow.dz = -arrow.dz;
    // 마지막 순간(아주 가까이)에 되받으면 '완벽' — 숙련 보상(둘 다 성공, 벌점 없음).
    events.push(playerDistance < CORRIDOR.perfectRange ? 'deflected-perfect' : 'deflected');
    return events;
  }
  if (playerDistance < CORRIDOR.hitRange) {
    // 놓침 — 벌점 없이 다시 날아온다(틀려도 다시 도전, 1막과 같은 회복 원칙).
    resetArrow(state);
    events.push('hit');
    return events;
  }
  if (Math.hypot(arrow.x, arrow.z) > CORRIDOR.fieldRadius) {
    resetArrow(state);
    events.push('missed');
  }
  return events;
}
