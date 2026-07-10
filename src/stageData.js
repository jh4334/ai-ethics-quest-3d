// 「잡음의 군도」 스테이지 프레임 — 순수 데이터 + 순수 로직 (THREE 무의존, node 테스트 가능).
// 기획서(docs/design/2막-잡음의-군도-기획서.md)의 프롤로그 + 5스테이지 골격을 데이터로 승격한다.
// 3D 표현·항해 씬은 이 데이터를 읽기만 한다 (DUNGEON_ROOMS ↔ dungeon.js 패턴).

// sea: 군도 지도의 상대 좌표 [x, z] — M2-S2 항해 씬이 섬 실루엣 배치에 사용한다.
// built: 이 빌드에 실제 콘텐츠가 들어왔는가. false면 항로 지도에 '준비 중' 실루엣으로만 보인다.
//        (순서 원칙: 배포본은 항상 처음부터 끝까지 플레이 가능 — 섬이 완성될 때만 true로 뒤집는다.)
export const STAGES = [
  {
    id: 'prologue',
    nameKo: '시작의 섬',
    frameKo: 'AI 윤리의 네 약속',
    themeKo: '개인정보 · 편향 · 저작권 · 딥페이크',
    verbKo: '약속의 도구 4종',
    emoji: '🏝️',
    sea: [0, 0],
    built: true,
    requires: null
  },
  {
    id: 'whisper-cape',
    nameKo: '속삭임 곶',
    frameKo: '내가 남기는 것',
    themeKo: '악플·혐오표현 + 디지털 발자국',
    verbKo: '🛡️ 막기·밀쳐내기',
    emoji: '🌊',
    sea: [-16, -9],
    built: true,
    requires: 'prologue'
  },
  {
    id: 'echo-cave',
    nameKo: '메아리 동굴',
    frameKo: '내게 들어오는 것',
    themeKo: '가짜뉴스·출처 + 필터버블',
    verbKo: '🔔 울림 충격파 · 🪞 정체 드러내기',
    emoji: '🕳️',
    sea: [12, -14],
    built: true,
    requires: 'whisper-cape'
  },
  {
    id: 'hourglass-port',
    nameKo: '모래시계 항구',
    frameKo: 'AI와 나의 습관',
    themeKo: '스크린타임·디지털 웰빙 + 생성물 표시',
    verbKo: '🧭 끌어당기기',
    emoji: '⏳',
    sea: [-6, -20],
    built: true,
    requires: 'echo-cave'
  },
  {
    id: 'memory-outer',
    nameKo: '기억의 심장 · 외곽',
    frameKo: '함께 살아가기',
    themeKo: '종합 + 인간-AI 협업',
    verbKo: '4동사 조합',
    emoji: '💠',
    sea: [8, -26],
    built: false,
    requires: 'hourglass-port'
  },
  {
    id: 'memory-core',
    nameKo: '기억의 심장 · 심부',
    frameKo: '최종 재대결',
    themeKo: '노이즈 리매치 — 페이즈마다 다른 동사',
    verbKo: '4동사 총동원',
    emoji: '⚡',
    sea: [8, -34],
    built: false,
    requires: 'memory-outer'
  }
];

const stageIdSet = new Set(STAGES.map((stage) => stage.id));

export function getStageById(stageId) {
  return STAGES.find((stage) => stage.id === stageId) ?? null;
}

// 세이브 v2의 stages 맵 정규화 — 알 수 없는 섬·깨진 값은 버린다.
export function normalizeStages(candidate) {
  const stages = {};
  if (!candidate || typeof candidate !== 'object') {
    return stages;
  }
  for (const [id, entry] of Object.entries(candidate)) {
    if (!stageIdSet.has(id) || !entry || typeof entry !== 'object') {
      continue;
    }
    stages[id] = { completed: entry.completed === true, visited: entry.visited === true };
  }
  return stages;
}

// 스테이지 완료 기록(순수 함수) — 각 섬의 정령 치료 시점에 호출한다.
export function markStageCompleted(progress, stageId) {
  if (!stageIdSet.has(stageId)) {
    throw new RangeError(`Unknown stage: ${stageId}`);
  }
  const prev = progress.stages?.[stageId] ?? {};
  return {
    ...progress,
    stages: { ...(progress.stages ?? {}), [stageId]: { ...prev, visited: true, completed: true } }
  };
}

// 첫 상륙 기록(순수 함수) — 도착 서사를 한 번만 틀기 위한 신호.
export function markStageVisited(progress, stageId) {
  if (!stageIdSet.has(stageId)) {
    throw new RangeError(`Unknown stage: ${stageId}`);
  }
  const prev = progress.stages?.[stageId] ?? {};
  return {
    ...progress,
    stages: { ...(progress.stages ?? {}), [stageId]: { ...prev, completed: prev.completed === true, visited: true } }
  };
}

// 항해 씬: 뗏목 위치에서 범위 안의 가장 가까운 섬(순수 함수).
// seaScale(sea 좌표 → 월드 배율)은 표현 계층이 정해서 넘긴다.
export function nearestSeaIsland(x, z, seaScale, range) {
  let best = null;
  let bestDistance = range;
  for (const stage of STAGES) {
    const distance = Math.hypot(x - stage.sea[0] * seaScale, z - stage.sea[1] * seaScale);
    if (distance < bestDistance) {
      best = stage;
      bestDistance = distance;
    }
  }
  return best;
}

// 스테이지별 상태 판정(순수 함수).
// 프롤로그 완료는 기존 신호(aiCoreCompleted)에서 파생한다 — 같은 사실을 두 곳에 쓰지 않는다.
// state: 'current'(열림·진행 중) | 'completed'(완료) | 'locked'(이전 섬 미완) | 'coming'(콘텐츠 준비 중)
export function getStageStates(progress) {
  const stages = progress?.stages ?? {};
  const completedById = new Map(
    STAGES.map((stage) => [
      stage.id,
      stage.id === 'prologue' ? progress?.aiCoreCompleted === true : stages[stage.id]?.completed === true
    ])
  );
  return STAGES.map((stage) => {
    const completed = completedById.get(stage.id);
    const requirementMet = !stage.requires || completedById.get(stage.requires) === true;
    let state;
    if (completed) {
      state = 'completed';
    } else if (!requirementMet) {
      state = 'locked';
    } else if (!stage.built) {
      state = 'coming';
    } else {
      state = 'current';
    }
    return { ...stage, completed, state };
  });
}
