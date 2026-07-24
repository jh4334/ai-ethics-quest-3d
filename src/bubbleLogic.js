// 「필터 버블의 창」 — 4장 후속 도전. 순수 로직(THREE 무의존).
// 반복되는 주장 하나가 아니라 원본·맥락·다른 관점을 함께 확인해야 버블이 열린다.

export const BUBBLE = {
  sources: [
    {
      id: 'original',
      x: -6.8,
      z: -4.7,
      emoji: '📜',
      labelKo: '원본과 만든 사람',
      required: true
    },
    {
      id: 'context',
      x: -7.8,
      z: -0.8,
      emoji: '🗓️',
      labelKo: '날짜와 앞뒤 맥락',
      required: true
    },
    {
      id: 'different-view',
      x: -6.4,
      z: 3.3,
      emoji: '🪟',
      labelKo: '다른 관점의 자료',
      required: true
    },
    {
      id: 'repeat-feed',
      x: -2.9,
      z: 5.7,
      emoji: '🔁',
      labelKo: '추천 피드의 같은 주장',
      required: false
    }
  ],
  inspectRange: 2.1
};

export function createBubbleState() {
  return {
    verified: Object.fromEntries(BUBBLE.sources.map((source) => [source.id, false])),
    cleared: false
  };
}

export function nearestBubbleSource(state, x, z, range = BUBBLE.inspectRange) {
  let best = null;
  let bestDistance = range;
  for (const source of BUBBLE.sources) {
    if (state.verified[source.id]) {
      continue;
    }
    const distance = Math.hypot(x - source.x, z - source.z);
    if (distance < bestDistance) {
      best = source;
      bestDistance = distance;
    }
  }
  return best;
}

// events: 'echo' | 'verified' | 'cleared'
export function inspectBubbleSource(state, sourceId) {
  if (state.cleared || state.verified[sourceId]) {
    return [];
  }
  const source = BUBBLE.sources.find((item) => item.id === sourceId);
  if (!source) {
    return [];
  }
  if (!source.required) {
    return ['echo'];
  }
  state.verified[sourceId] = true;
  const events = ['verified'];
  if (BUBBLE.sources.filter((item) => item.required).every((item) => state.verified[item.id])) {
    state.cleared = true;
    events.push('cleared');
  }
  return events;
}
