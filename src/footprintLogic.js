// 「남겨진 발자국」 — 3장 후속 도전. 순수 로직(THREE 무의존).
// 디지털 흔적을 책임지는 세 행동을 실제 공간에서 올바른 순서로 실행한다.

export const FOOTPRINT = {
  actions: [
    {
      id: 'remove-copy',
      x: -2.2,
      z: 7.4,
      emoji: '🧹',
      labelKo: '내가 퍼뜨린 복사본 지우기'
    },
    {
      id: 'stop-spread',
      x: 1.5,
      z: 8.8,
      emoji: '✋',
      labelKo: '단체방에 확산 중단 요청하기'
    },
    {
      id: 'repair-harm',
      x: 5.0,
      z: 7.1,
      emoji: '💛',
      labelKo: '상처받은 친구에게 사과하고 돕기'
    }
  ],
  actionRange: 1.9
};

export function createFootprintState() {
  return {
    step: 0,
    resolved: Object.fromEntries(FOOTPRINT.actions.map((action) => [action.id, false])),
    cleared: false
  };
}

export function nearestFootprintAction(state, x, z, range = FOOTPRINT.actionRange) {
  let best = null;
  let bestDistance = range;
  for (const action of FOOTPRINT.actions) {
    if (state.resolved[action.id]) {
      continue;
    }
    const distance = Math.hypot(x - action.x, z - action.z);
    if (distance < bestDistance) {
      best = action;
      bestDistance = distance;
    }
  }
  return best;
}

// events: 'out-of-order' | 'resolved' | 'cleared'
export function resolveFootprintAction(state, actionId) {
  if (state.cleared || state.resolved[actionId]) {
    return [];
  }
  const expected = FOOTPRINT.actions[state.step];
  if (!expected || expected.id !== actionId) {
    return ['out-of-order'];
  }
  state.resolved[actionId] = true;
  state.step += 1;
  const events = ['resolved'];
  if (state.step === FOOTPRINT.actions.length) {
    state.cleared = true;
    events.push('cleared');
  }
  return events;
}
