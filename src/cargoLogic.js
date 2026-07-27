// 「표시 없는 화물」 — 5장 후속 도전. 순수 로직(THREE 무의존).
// 제작 과정을 읽고 사람 제작·AI 도움·AI 생성 라벨을 붙인 뒤 적하 목록을 검수한다.

export const CARGO_LABELS = ['unknown', 'human', 'ai-assisted', 'ai-generated'];

export const CARGO = {
  crates: [
    {
      id: 'poster',
      x: 4.4,
      z: 6.7,
      emoji: '🖌️',
      titleKo: '손그림 포스터',
      clueKo: '민지가 종이에 직접 그리고 색칠함',
      correctLabel: 'human'
    },
    {
      id: 'slides',
      x: 5.7,
      z: 5.3,
      emoji: '🧩',
      titleKo: '발표 슬라이드',
      clueKo: 'AI 초안을 사람이 사실 확인하고 다시 씀',
      correctLabel: 'ai-assisted'
    },
    {
      id: 'jingle',
      x: 3.8,
      z: 4.8,
      emoji: '🎵',
      titleKo: '항구 홍보 음악',
      clueKo: '생성형 AI가 프롬프트로 완성본을 만듦',
      correctLabel: 'ai-generated'
    }
  ],
  actionRange: 1.65
};

export const CARGO_LABEL_KO = {
  unknown: '표시 없음',
  human: '사람이 직접 제작',
  'ai-assisted': 'AI 도움 + 사람 검토',
  'ai-generated': 'AI 생성'
};

export function createCargoState() {
  return {
    labels: Object.fromEntries(CARGO.crates.map((crate) => [crate.id, 'unknown'])),
    cleared: false
  };
}

export function nearestCargoCrate(x, z, range = CARGO.actionRange) {
  let best = null;
  let bestDistance = range;
  for (const crate of CARGO.crates) {
    const distance = Math.hypot(x - crate.x, z - crate.z);
    if (distance < bestDistance) {
      best = crate;
      bestDistance = distance;
    }
  }
  return best;
}

export function cycleCargoLabel(state, crateId) {
  if (state.cleared || !Object.hasOwn(state.labels, crateId)) {
    return null;
  }
  const index = CARGO_LABELS.indexOf(state.labels[crateId]);
  const next = CARGO_LABELS[(index + 1) % CARGO_LABELS.length];
  state.labels[crateId] = next;
  return next;
}

// events: ['incomplete', wrongIds] | ['cleared', []]
export function verifyCargoManifest(state) {
  if (state.cleared) {
    return { event: 'cleared', wrongIds: [] };
  }
  const wrongIds = CARGO.crates
    .filter((crate) => state.labels[crate.id] !== crate.correctLabel)
    .map((crate) => crate.id);
  if (wrongIds.length > 0) {
    return { event: 'incomplete', wrongIds };
  }
  state.cleared = true;
  return { event: 'cleared', wrongIds: [] };
}
