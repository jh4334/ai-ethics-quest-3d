// 구역별 '분류 미니게임' 데이터와 순수 채점 로직.
// 객관식 일변도를 벗어나, 여러 단서 카드를 '안전 / 조심' 두 바구니로 나누는 퍼즐이다.
// UI(탭으로 카드를 바구니에 담기)는 main.js가 담당하고, 여기서는 데이터와 판정만 다룬다.

export const CLASSIFY_BUCKETS = [
  { id: 'safe', labelKo: '안전해요', emoji: '🟢' },
  { id: 'caution', labelKo: '조심해요', emoji: '🔴' }
];

export const CLASSIFY_CHALLENGES = {
  privacy: {
    topicId: 'privacy',
    titleKo: '개인정보 분류 도전',
    promptKo: 'AI 앱에 넣어도 되는 것과 조심해야 하는 것을 나눠 보세요.',
    cards: [
      { id: 'p1', textKo: '내가 만든 별명', answer: 'safe' },
      { id: 'p2', textKo: '우리 집 주소', answer: 'caution' },
      { id: 'p3', textKo: '좋아하는 색깔', answer: 'safe' },
      { id: 'p4', textKo: '친구 얼굴 사진', answer: 'caution' }
    ]
  },
  bias: {
    topicId: 'bias',
    titleKo: '공정함 분류 도전',
    promptKo: 'AI 결과를 대하는 태도 중 공정한 것과 위험한 것을 나눠 보세요.',
    cards: [
      { id: 'b1', textKo: '여러 관점을 더 확인한다', answer: 'safe' },
      { id: 'b2', textKo: '첫 결과를 무조건 믿는다', answer: 'caution' },
      { id: 'b3', textKo: '빠진 사람이 없는지 살핀다', answer: 'safe' },
      { id: 'b4', textKo: '한 가지 모습만 정답이라 한다', answer: 'caution' }
    ]
  },
  copyright: {
    topicId: 'copyright',
    titleKo: '저작권 분류 도전',
    promptKo: 'AI 결과물을 쓸 때 바른 행동과 아닌 행동을 나눠 보세요.',
    cards: [
      { id: 'c1', textKo: '참고한 자료의 출처를 밝힌다', answer: 'safe' },
      { id: 'c2', textKo: '남의 그림을 그대로 베낀다', answer: 'caution' },
      { id: 'c3', textKo: '사용해도 되는 자료인지 확인한다', answer: 'safe' },
      { id: 'c4', textKo: '내가 만든 척 출처를 숨긴다', answer: 'caution' }
    ]
  },
  deepfake: {
    topicId: 'deepfake',
    titleKo: '진실 확인 분류 도전',
    promptKo: '이상한 AI 영상·음성을 만났을 때 바른 행동을 나눠 보세요.',
    cards: [
      { id: 'd1', textKo: '출처와 사실을 먼저 확인한다', answer: 'safe' },
      { id: 'd2', textKo: '충격적이니 바로 퍼뜨린다', answer: 'caution' },
      { id: 'd3', textKo: '믿을 만한 어른에게 알린다', answer: 'safe' },
      { id: 'd4', textKo: '친구를 놀리는 데 쓴다', answer: 'caution' }
    ]
  }
};

export function getClassifyChallenge(topicId) {
  return CLASSIFY_CHALLENGES[topicId] ?? null;
}

// assignments: { [cardId]: bucketId }. 배정되지 않은 카드는 오답으로 간주한다.
export function scoreClassify(topicId, assignments) {
  const challenge = getClassifyChallenge(topicId);
  if (!challenge) {
    throw new RangeError(`Unknown classify topic: ${topicId}`);
  }
  const safeAssignments = assignments && typeof assignments === 'object' ? assignments : {};

  const perCard = challenge.cards.map((card) => ({
    cardId: card.id,
    assigned: safeAssignments[card.id] ?? null,
    correct: safeAssignments[card.id] === card.answer
  }));

  const correct = perCard.filter((entry) => entry.correct).length;
  const total = challenge.cards.length;

  return {
    topicId,
    correct,
    total,
    passed: correct === total,
    perCard
  };
}
