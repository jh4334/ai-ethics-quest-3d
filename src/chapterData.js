// 6장 캠페인의 서사·진행 프레임.
//
// 기존 월드/섬 ID는 그대로 유지해 오래된 세이브와 3D 씬을 보존하고,
// 플레이어에게 보이는 장(章) 단위만 이 계층에서 재구성한다.
export const CAMPAIGN_CHAPTERS = [
  {
    id: 'chapter-1',
    number: 1,
    titleKo: '안개가 삼킨 이름',
    shortKo: '잃어버린 이름',
    themeKo: '개인정보 · 편향',
    questionKo: 'AI가 나를 기억한다면, 어떤 정보까지 가져도 될까?',
    objectiveKo: '안개의 섬에서 지워진 이름과 첫 기억을 찾으세요.',
    color: '#7ad7b2',
    stageIds: ['prologue']
  },
  {
    id: 'chapter-2',
    number: 2,
    titleKo: '가짜 얼굴의 신전',
    shortKo: '가짜 얼굴',
    themeKo: '저작권 · 딥페이크',
    questionKo: '그럴듯하게 만든 것은 누구의 것이고, 어디까지 진짜일까?',
    objectiveKo: '거울 신전에서 훔친 목소리와 바뀐 얼굴의 주인을 찾으세요.',
    color: '#f4b860',
    stageIds: ['prologue']
  },
  {
    id: 'chapter-3',
    number: 3,
    titleKo: '말이 남긴 상처',
    shortKo: '남겨진 말',
    themeKo: '악플 · 혐오표현 · 디지털 발자국',
    questionKo: '한 번 보낸 말은 어디까지 남아 있을까?',
    objectiveKo: '상처 입은 말의 파편을 막고, 남겨진 발자국을 따라가세요.',
    color: '#f4b860',
    stageIds: ['whisper-cape']
  },
  {
    id: 'chapter-4',
    number: 4,
    titleKo: '같은 목소리의 바다',
    shortKo: '메아리 바다',
    themeKo: '가짜뉴스 · 출처 · 필터버블',
    questionKo: '모두가 같은 말을 반복하면 그것은 사실이 될까?',
    objectiveKo: '메아리 사이에서 원본의 목소리와 다른 관점을 찾으세요.',
    color: '#8fb8ff',
    stageIds: ['echo-cave']
  },
  {
    id: 'chapter-5',
    number: 5,
    titleKo: '멈추지 않는 밤',
    shortKo: '멈추는 밤',
    themeKo: '디지털 웰빙 · AI 의존 · 생성물 표시',
    questionKo: 'AI가 계속 대신해 준다면, 나는 언제 멈추고 직접 선택해야 할까?',
    objectiveKo: '멈추지 않는 항구의 시간을 되돌리고 숨겨진 생성물 표시를 찾으세요.',
    color: '#c3a6ff',
    stageIds: ['hourglass-port']
  },
  {
    id: 'chapter-6',
    number: 6,
    titleKo: '기억의 심장',
    shortKo: '기억의 심장',
    themeKo: '책임 · 인간과 AI의 협업',
    questionKo: '내가 잘못 가르친 AI를 지울까, 책임지고 다시 가르칠까?',
    objectiveKo: '모든 기억을 마주하고 노이즈와 함께 마지막 선택을 하세요.',
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
