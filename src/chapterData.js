// 6장 미스터리 캠페인의 서사·진행 프레임.
//
// 기존 월드/섬 ID는 그대로 유지해 오래된 세이브와 3D 씬을 보존하고,
// 플레이어에게 보이는 장(章) 단위만 이 계층에서 재구성한다.
export const CAMPAIGN_CHAPTERS = [
  {
    id: 'chapter-1',
    number: 1,
    titleKo: '명단에서 사라진 아이',
    shortKo: '사라진 H-17',
    themeKo: '개인정보 · 편향',
    questionKo: '안전을 이유로 친구의 사적인 정보까지 모아도 될까?',
    objectiveKo: '하루의 삭제 요청서와 기울어진 위험 점수를 복구하세요.',
    color: '#7ad7b2',
    stageIds: ['prologue']
  },
  {
    id: 'chapter-2',
    number: 2,
    titleKo: '거짓 영상의 주인',
    shortKo: '원본 없는 영상',
    themeKo: '저작권 · 딥페이크',
    questionKo: '모두가 공유한 영상에 원본이 없다면 무엇을 믿어야 할까?',
    objectiveKo: '지워진 제작 기록과 하루를 몰아낸 조작 영상의 생성 흔적을 찾으세요.',
    color: '#f4b860',
    stageIds: ['prologue']
  },
  {
    id: 'chapter-3',
    number: 3,
    titleKo: '웃음이 만든 폭풍',
    shortKo: '퍼져 버린 농담',
    themeKo: '악플 · 혐오표현 · 디지털 발자국',
    questionKo: '직접 쓰지 않은 악플도 웃고 공유했다면 책임이 있을까?',
    objectiveKo: '하루를 향한 조롱이 확산된 경로를 끊고 피해 회복 순서를 실행하세요.',
    color: '#f4b860',
    stageIds: ['whisper-cape']
  },
  {
    id: 'chapter-4',
    number: 4,
    titleKo: '두 개의 진실',
    shortKo: '갈라진 추천',
    themeKo: '가짜뉴스 · 출처 · 필터버블',
    questionKo: '서로 다른 화면만 본 두 사람은 같은 사건을 판단할 수 있을까?',
    objectiveKo: '하루를 유죄로 만든 추천 경로 밖에서 원본과 반대 증거를 찾으세요.',
    color: '#8fb8ff',
    stageIds: ['echo-cave']
  },
  {
    id: 'chapter-5',
    number: 5,
    titleKo: '아무도 결정하지 않는 밤',
    shortKo: '자동 결정 항구',
    themeKo: '디지털 웰빙 · AI 의존 · 생성물 표시',
    questionKo: 'AI의 추천을 그대로 따른 결정은 결국 누구의 책임일까?',
    objectiveKo: '자동 결정 항구를 멈추고, 사람과 AI의 역할이 숨겨진 기록에 라벨을 붙이세요.',
    color: '#c3a6ff',
    stageIds: ['hourglass-port']
  },
  {
    id: 'chapter-6',
    number: 6,
    titleKo: '마지막 증언',
    shortKo: '공개 심리',
    themeKo: '책임 · 이의제기권 · 인간의 감독',
    questionKo: '잘못된 자동 결정을 발견했을 때 누가 설명하고 바로잡아야 할까?',
    objectiveKo: '화이트아웃 승인 기록을 열고, 하루의 개인정보를 지키며 공개 심리를 준비하세요.',
    color: '#f3efe4',
    stageIds: ['memory-outer', 'memory-core']
  }
];

const chapterById = new Map(CAMPAIGN_CHAPTERS.map((chapter) => [chapter.id, chapter]));

export function getChapterById(chapterId) {
  return chapterById.get(chapterId) ?? null;
}

function hasFragments(progress, ids) {
  const collected = new Set(Array.isArray(progress?.collectedFragments) ? progress.collectedFragments : []);
  return ids.every((id) => collected.has(id));
}

export function getChapterStates(progress) {
  if (progress?.campaignCompleted === true) {
    return CAMPAIGN_CHAPTERS.map((chapter) => ({ ...chapter, state: 'completed' }));
  }
  const stages = progress?.stages ?? {};
  const completed = [
    hasFragments(progress, ['privacy', 'bias']),
    progress?.aiCoreCompleted === true,
    stages['whisper-cape']?.completed === true,
    stages['echo-cave']?.completed === true,
    stages['hourglass-port']?.completed === true,
    progress?.campaignCompleted === true
  ];

  return CAMPAIGN_CHAPTERS.map((chapter, index) => {
    let state = 'locked';
    if (completed[index]) {
      state = 'completed';
    } else if (index === 0 || completed[index - 1]) {
      state = 'current';
    }
    return { ...chapter, state };
  });
}

export function getCurrentChapter(progress) {
  const states = getChapterStates(progress);
  return states.find((chapter) => chapter.state === 'current')
    ?? states.at(-1)
    ?? CAMPAIGN_CHAPTERS[0];
}

export function getCampaignSummary(progress) {
  const chapters = getChapterStates(progress);
  const completed = chapters.filter((chapter) => chapter.state === 'completed').length;
  return {
    chapters,
    current: getCurrentChapter(progress),
    completed,
    total: chapters.length,
    campaignCompleted: progress?.campaignCompleted === true
  };
}

export function completeCampaign(progress) {
  return {
    ...progress,
    campaignCompleted: true
  };
}
