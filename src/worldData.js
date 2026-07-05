export const ETHICS_TOPICS = [
  {
    id: 'privacy',
    titleKo: '개인정보',
    fragmentKo: '개인정보 조각',
    color: '#3f8f75',
    studentTakeaway: 'AI를 사용할 때 이름, 얼굴, 위치, 연락처처럼 나를 알아볼 수 있는 정보는 꼭 필요할 때만 조심해서 사용해요.',
    classroomQuestion: 'AI 앱에 사진이나 글을 넣기 전에 무엇을 먼저 확인해야 할까요?',
    safeRule: '필요한 정보만, 허락받고, 목적을 알고 사용하기',
    vocabularyKo: ['개인정보', '동의', '목적']
  },
  {
    id: 'bias',
    titleKo: '편향',
    fragmentKo: '공정성 조각',
    color: '#6f7fd3',
    studentTakeaway: 'AI는 배운 자료가 한쪽으로 치우치면 결과도 치우칠 수 있어요. 여러 사람의 입장을 확인해야 해요.',
    classroomQuestion: 'AI의 대답이 모든 사람에게 공평한지 어떻게 살펴볼 수 있을까요?',
    safeRule: '한 가지 결과만 믿지 말고 빠진 사람과 다른 관점 확인하기',
    vocabularyKo: ['편향', '공정성', '자료']
  },
  {
    id: 'copyright',
    titleKo: '저작권',
    fragmentKo: '창작 존중 조각',
    color: '#c98a32',
    studentTakeaway: 'AI로 만든 결과도 다른 사람의 글, 그림, 음악을 존중해야 해요. 출처와 사용 가능 조건을 확인해요.',
    classroomQuestion: 'AI가 만든 이미지나 글을 발표에 쓸 때 어떤 표시가 필요할까요?',
    safeRule: '출처 확인, 허락 확인, 내 생각과 수정한 부분 밝히기',
    vocabularyKo: ['저작권', '출처', '허락']
  },
  {
    id: 'deepfake',
    titleKo: '딥페이크',
    fragmentKo: '진실 확인 조각',
    color: '#8a5eb8',
    studentTakeaway: 'AI로 만든 사진, 목소리, 영상은 진짜처럼 보일 수 있어요. 공유하기 전에 사실인지 확인해야 해요.',
    classroomQuestion: '믿기 어려운 영상이나 음성을 보았을 때 바로 공유하지 말아야 하는 이유는 무엇일까요?',
    safeRule: '멈추기, 출처 확인하기, 믿을 수 있는 어른이나 자료와 비교하기',
    vocabularyKo: ['딥페이크', '사실 확인', '공유 책임']
  }
];

export const WORLD_ZONES = [
  {
    id: 'privacy-village',
    topicId: 'privacy',
    nameKo: '개인정보 마을',
    shortNameKo: '정보 마을',
    descriptionKo: '작은 집과 우체통이 모인 마을입니다. AI 도우미에게 어떤 정보를 알려도 되는지 배우는 곳입니다.',
    position: [-7.5, 0, -5.2],
    npc: {
      id: 'privacy-keeper',
      nameKo: '데이터 지킴이 민',
      prompt: 'AI 추천 앱이 친구의 사진과 이름을 물어보면 어떻게 해야 할까요?',
      lesson: '개인정보는 나와 다른 사람을 알아볼 수 있게 하는 정보예요. AI에 넣기 전에 꼭 필요한지, 허락을 받았는지, 어디에 쓰이는지 확인해요.',
      reflection: '친구 사진을 AI에 넣기 전에 친구와 보호자에게 물어봐야 하는 까닭을 말해 보세요.'
    },
    shrineId: 'privacy-shrine'
  },
  {
    id: 'bias-forest',
    topicId: 'bias',
    nameKo: '편향의 숲',
    shortNameKo: '공정 숲',
    descriptionKo: '서로 다른 나무가 자라는 숲입니다. AI가 한쪽 자료만 배우면 결과가 치우칠 수 있음을 살펴봅니다.',
    position: [7.6, 0, -5.1],
    npc: {
      id: 'fairness-ranger',
      nameKo: '공정 탐험가 라온',
      prompt: 'AI가 “운동을 잘하는 사람”을 한 모습으로만 그렸다면 무엇을 확인해야 할까요?',
      lesson: 'AI 결과는 학습한 자료의 영향을 받아요. 빠진 사람은 없는지, 다른 모습과 상황도 들어 있는지 비교하면 더 공정한 판단을 할 수 있어요.',
      reflection: '우리 반 모두가 공평하게 포함되도록 AI에게 질문을 바꾸어 보세요.'
    },
    shrineId: 'bias-shrine'
  },
  {
    id: 'copyright-ruins',
    topicId: 'copyright',
    nameKo: '저작권 유적',
    shortNameKo: '창작 유적',
    descriptionKo: '책 조각과 무대가 놓인 유적입니다. AI 결과를 사용할 때 창작자와 출처를 존중하는 법을 배웁니다.',
    position: [-7.3, 0, 5.6],
    npc: {
      id: 'credit-archivist',
      nameKo: '출처 기록가 소율',
      prompt: 'AI가 만든 그림을 발표 자료에 넣을 때 어떤 설명을 남기면 좋을까요?',
      lesson: 'AI 결과물을 사용할 때도 참고한 자료, 만든 도구, 내가 고친 부분을 밝히면 더 정직한 발표가 돼요. 사용 가능한 자료인지 확인하는 습관도 중요해요.',
      reflection: '발표 자료 맨 아래에 쓸 수 있는 출처 문장을 하나 만들어 보세요.'
    },
    shrineId: 'copyright-shrine'
  },
  {
    id: 'deepfake-cave',
    topicId: 'deepfake',
    nameKo: '딥페이크 동굴',
    shortNameKo: '진실 동굴',
    descriptionKo: '빛과 그림자가 흔들리는 동굴입니다. AI로 만든 사진, 목소리, 영상의 진짜 여부를 확인하는 법을 익힙니다.',
    position: [7.1, 0, 5.7],
    npc: {
      id: 'truth-guide',
      nameKo: '진실 안내자 해나',
      prompt: 'AI 목소리 영상이 친구에게 상처를 줄 수 있다면 공유하기 전에 무엇을 해야 할까요?',
      lesson: '딥페이크는 진짜처럼 보이거나 들리는 AI 합성 자료예요. 놀랍거나 화나는 내용일수록 멈추고 출처, 날짜, 다른 믿을 만한 자료를 확인해요.',
      reflection: '가짜일 수 있는 영상을 발견했을 때 우리 반 약속을 한 문장으로 써 보세요.'
    },
    shrineId: 'deepfake-shrine'
  }
];

export const SHRINES = [
  {
    id: 'privacy-shrine',
    topicId: 'privacy',
    nameKo: '비밀 약속의 사당',
    questionKo: 'AI 그림 앱이 “친구 얼굴 사진을 올리면 더 재미있는 그림을 만들어 줄게”라고 말했습니다. 가장 안전한 선택은?',
    choices: [
      {
        id: 'upload-now',
        textKo: '재미있어 보이니 바로 올린다.',
        correct: false
      },
      {
        id: 'ask-and-limit',
        textKo: '친구와 보호자에게 허락을 받고, 꼭 필요한지와 저장 여부를 확인한다.',
        correct: true
      },
      {
        id: 'change-name-only',
        textKo: '이름만 지우면 얼굴 사진은 마음대로 써도 된다.',
        correct: false
      }
    ],
    feedback: {
      correct: '좋아요. 얼굴 사진도 개인정보가 될 수 있으므로 허락, 필요성, 사용 목적을 함께 확인해야 해요.',
      incorrect: '조금 더 생각해 봐요. 얼굴, 이름, 위치처럼 사람을 알아볼 수 있는 정보는 허락과 목적 확인이 필요해요.'
    }
  },
  {
    id: 'bias-shrine',
    topicId: 'bias',
    nameKo: '공정한 거울의 사당',
    questionKo: 'AI가 “미래 과학자” 그림을 모두 비슷한 모습으로만 만들었습니다. 더 공정하게 고치는 방법은?',
    choices: [
      {
        id: 'accept-first',
        textKo: 'AI가 만들었으니 첫 결과가 항상 맞다고 믿는다.',
        correct: false
      },
      {
        id: 'ask-variety',
        textKo: '다양한 성별, 모습, 배경의 과학자를 포함하도록 다시 요청하고 비교한다.',
        correct: true
      },
      {
        id: 'hide-result',
        textKo: '아무에게도 보여 주지 않으면 편향이 사라진다.',
        correct: false
      }
    ],
    feedback: {
      correct: '맞아요. 여러 모습과 관점을 확인하면 AI 결과가 한쪽으로 치우쳤는지 살필 수 있어요.',
      incorrect: '다시 살펴봐요. AI 결과도 배운 자료에 따라 치우칠 수 있으니 빠진 사람과 관점을 확인해야 해요.'
    }
  },
  {
    id: 'copyright-shrine',
    topicId: 'copyright',
    nameKo: '출처의 종 사당',
    questionKo: 'AI로 만든 발표 포스터에 인터넷 사진과 문장을 참고했습니다. 발표 전에 해야 할 일은?',
    choices: [
      {
        id: 'no-credit',
        textKo: 'AI가 만들었으니 출처를 쓰지 않는다.',
        correct: false
      },
      {
        id: 'credit-and-check',
        textKo: '참고한 자료와 AI 도구를 밝히고, 사용할 수 있는 자료인지 확인한다.',
        correct: true
      },
      {
        id: 'copy-famous',
        textKo: '유명한 그림체와 문장을 그대로 따라 하면 더 멋지다.',
        correct: false
      }
    ],
    feedback: {
      correct: '정확해요. AI를 사용해도 다른 사람의 창작물과 출처를 존중하는 태도가 필요해요.',
      incorrect: '아쉬워요. AI 결과를 사용할 때도 참고 자료, 도구, 내가 수정한 내용을 정직하게 밝혀야 해요.'
    }
  },
  {
    id: 'deepfake-shrine',
    topicId: 'deepfake',
    nameKo: '진실의 메아리 사당',
    questionKo: '친구가 선생님 목소리처럼 들리는 이상한 AI 음성 파일을 보냈습니다. 가장 책임 있는 행동은?',
    choices: [
      {
        id: 'share-fast',
        textKo: '재미있으니 다른 채팅방에 바로 공유한다.',
        correct: false
      },
      {
        id: 'pause-check',
        textKo: '공유를 멈추고 출처를 확인한 뒤 믿을 수 있는 어른에게 알린다.',
        correct: true
      },
      {
        id: 'mock-friend',
        textKo: '누가 만들었는지 추측하며 친구를 놀린다.',
        correct: false
      }
    ],
    feedback: {
      correct: '좋은 판단이에요. 딥페이크일 수 있는 자료는 바로 퍼뜨리지 말고 확인과 도움 요청이 먼저예요.',
      incorrect: '다시 선택해 봐요. AI 합성 음성이나 영상은 누군가에게 피해를 줄 수 있어 공유 전에 멈추고 확인해야 해요.'
    }
  }
];

export const FINAL_CORE_MISSION = {
  id: 'ai-core',
  nameKo: 'AI 코어 최종 미션',
  unlockRequirement: 3,
  promptKo: '섬 중앙의 AI 코어가 묻습니다. “우리 반이 AI를 사용할 때 지킬 약속으로 가장 알맞은 것은?”',
  choices: [
    {
      id: 'speed-only',
      textKo: '빠른 결과가 나오면 확인하지 않고 그대로 사용한다.',
      correct: false
    },
    {
      id: 'balanced-promise',
      textKo: '개인정보를 지키고, 편향을 살피고, 출처를 밝히고, 진짜인지 확인한다.',
      correct: true
    },
    {
      id: 'secret-use',
      textKo: 'AI를 썼다는 사실은 말하지 않아도 된다.',
      correct: false
    }
  ],
  completionKo: 'AI 코어가 밝아졌습니다. 이제 우리 반 AI 윤리 약속을 토론하고 활동지에 정리하세요.'
};

const topicIdSet = new Set(ETHICS_TOPICS.map((topic) => topic.id));

export function getTopicById(topicId) {
  return ETHICS_TOPICS.find((topic) => topic.id === topicId) ?? null;
}

export function getZoneByTopicId(topicId) {
  return WORLD_ZONES.find((zone) => zone.topicId === topicId) ?? null;
}

export function getShrineById(shrineId) {
  return SHRINES.find((shrine) => shrine.id === shrineId) ?? null;
}

export function uniqueValidTopicIds(topicIds) {
  return [...new Set(topicIds)].filter((topicId) => topicIdSet.has(topicId));
}

export function canUnlockFinalCore(collectedTopicIds) {
  return uniqueValidTopicIds(collectedTopicIds).length >= FINAL_CORE_MISSION.unlockRequirement;
}

export function getProgressSummary(collectedTopicIds) {
  const uniqueCollected = uniqueValidTopicIds(collectedTopicIds);
  const remaining = ETHICS_TOPICS.filter((topic) => !uniqueCollected.includes(topic.id));

  return {
    collected: uniqueCollected.length,
    total: ETHICS_TOPICS.length,
    collectedTopicIds: uniqueCollected,
    remainingTopicIds: remaining.map((topic) => topic.id),
    finalCoreUnlocked: canUnlockFinalCore(uniqueCollected),
    nextTopicId: remaining[0]?.id ?? null
  };
}

export function createInitialProgress() {
  return {
    visitedTopics: [],
    completedShrines: [],
    collectedFragments: [],
    choiceLog: [],
    aiCoreCompleted: false
  };
}

export function normalizeProgress(candidate) {
  const base = createInitialProgress();
  if (!candidate || typeof candidate !== 'object') {
    return base;
  }

  const stringArray = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);
  const logArray = (value) =>
    Array.isArray(value)
      ? value.filter(
          (entry) =>
            entry
            && typeof entry === 'object'
            && typeof entry.choiceId === 'string'
            && typeof entry.correct === 'boolean'
        )
      : [];

  return {
    visitedTopics: uniqueValidTopicIds(stringArray(candidate.visitedTopics)),
    completedShrines: stringArray(candidate.completedShrines).filter((id) => Boolean(getShrineById(id))),
    collectedFragments: uniqueValidTopicIds(stringArray(candidate.collectedFragments)),
    choiceLog: logArray(candidate.choiceLog),
    aiCoreCompleted: candidate.aiCoreCompleted === true
  };
}

export function recordLearningVisit(progress, topicId) {
  if (!topicIdSet.has(topicId)) {
    throw new RangeError(`Unknown ethics topic: ${topicId}`);
  }

  return {
    ...progress,
    visitedTopics: [...new Set([...progress.visitedTopics, topicId])]
  };
}

export function evaluateShrineChoice(shrineId, choiceId) {
  const shrine = getShrineById(shrineId);
  if (!shrine) {
    throw new RangeError(`Unknown shrine: ${shrineId}`);
  }

  const choice = shrine.choices.find((item) => item.id === choiceId);
  if (!choice) {
    throw new RangeError(`Unknown choice "${choiceId}" for shrine "${shrineId}"`);
  }

  return {
    shrineId,
    topicId: shrine.topicId,
    choiceId,
    correct: choice.correct,
    feedbackKo: choice.correct ? shrine.feedback.correct : shrine.feedback.incorrect,
    fragmentId: choice.correct ? shrine.topicId : null
  };
}

export function applyShrineResult(progress, shrineId, choiceId) {
  const result = evaluateShrineChoice(shrineId, choiceId);
  const visitedTopics = [...new Set([...progress.visitedTopics, result.topicId])];
  const choiceLog = [
    ...(progress.choiceLog ?? []),
    { kind: 'shrine', shrineId, topicId: result.topicId, choiceId, correct: result.correct }
  ];

  if (!result.correct) {
    return {
      result,
      progress: {
        ...progress,
        visitedTopics,
        choiceLog
      }
    };
  }

  return {
    result,
    progress: {
      ...progress,
      visitedTopics,
      choiceLog,
      completedShrines: [...new Set([...progress.completedShrines, shrineId])],
      collectedFragments: [...new Set([...progress.collectedFragments, result.topicId])]
    }
  };
}

export function evaluateFinalCoreChoice(choiceId) {
  const choice = FINAL_CORE_MISSION.choices.find((item) => item.id === choiceId);
  if (!choice) {
    throw new RangeError(`Unknown final core choice: ${choiceId}`);
  }

  return {
    choiceId,
    correct: choice.correct,
    feedbackKo: choice.correct
      ? FINAL_CORE_MISSION.completionKo
      : 'AI 윤리 약속은 빠름보다 책임이 중요해요. 네 가지 조각의 약속을 다시 떠올려 보세요.'
  };
}

export function completeFinalCore(progress, choiceId) {
  if (!canUnlockFinalCore(progress.collectedFragments)) {
    return {
      unlocked: false,
      result: null,
      progress,
      messageKo: `${FINAL_CORE_MISSION.unlockRequirement}개 이상의 윤리 조각을 모으면 AI 코어가 열려요.`
    };
  }

  const result = evaluateFinalCoreChoice(choiceId);
  return {
    unlocked: true,
    result,
    progress: {
      ...progress,
      choiceLog: [
        ...(progress.choiceLog ?? []),
        { kind: 'core', topicId: null, choiceId, correct: result.correct }
      ],
      aiCoreCompleted: progress.aiCoreCompleted || result.correct
    },
    messageKo: result.feedbackKo
  };
}

const TOPIC_STATUS_LABELS = {
  'first-try': '첫 도전에 해결',
  retry: '다시 도전해 해결',
  struggling: '복습 추천',
  visited: '대화만 완료',
  'not-started': '탐험 전'
};

export function getLearningReport(progress) {
  const log = progress.choiceLog ?? [];

  const topics = ETHICS_TOPICS.map((topic) => {
    const attempts = log.filter((entry) => entry.kind === 'shrine' && entry.topicId === topic.id);
    const solved = progress.collectedFragments.includes(topic.id);
    const visited = progress.visitedTopics.includes(topic.id);

    let status = 'not-started';
    if (solved) {
      status = attempts.length > 0 && attempts[0].correct ? 'first-try' : 'retry';
    } else if (attempts.length > 0) {
      status = 'struggling';
    } else if (visited) {
      status = 'visited';
    }

    return {
      topicId: topic.id,
      titleKo: topic.titleKo,
      attempts: attempts.length,
      solved,
      status,
      statusKo: TOPIC_STATUS_LABELS[status],
      // 오답 경험이 있는 주제는 수업 회고 질문으로 연결한다.
      reviewQuestionKo: status === 'retry' || status === 'struggling' ? topic.classroomQuestion : null
    };
  });

  const coreAttempts = log.filter((entry) => entry.kind === 'core');

  return {
    topics,
    reviewTopics: topics.filter((topic) => topic.reviewQuestionKo),
    totalChoices: log.length,
    firstTryCount: topics.filter((topic) => topic.status === 'first-try').length,
    solvedCount: topics.filter((topic) => topic.solved).length,
    core: {
      attempts: coreAttempts.length,
      completed: progress.aiCoreCompleted
    }
  };
}

export function getNextObjective(progress) {
  const summary = getProgressSummary(progress.collectedFragments);

  if (progress.aiCoreCompleted) {
    return '활동지에 우리 반 AI 윤리 약속을 정리하세요.';
  }

  if (summary.finalCoreUnlocked) {
    return '섬 중앙 AI 코어로 돌아가 최종 미션을 해결하세요.';
  }

  const nextTopic = getTopicById(summary.nextTopicId);
  if (!nextTopic) {
    return '남은 대화를 확인하고 AI 코어로 돌아가세요.';
  }

  return `${nextTopic.titleKo} 구역에서 NPC와 대화하고 사당 문제를 해결하세요.`;
}

