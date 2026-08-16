const phase = (id, label, pattern, instruction) => Object.freeze({ id, label, pattern, instruction });

const mechanics = (data) => Object.freeze({
  ...data,
  enemyKinds: Object.freeze([...data.enemyKinds]),
  bossPhases: Object.freeze(data.bossPhases.map((item) => phase(...item))),
  chainSteps: Object.freeze(data.chainSteps ?? [])
});

export const CAMPAIGN_MECHANICS = Object.freeze({
  'chapter-1': mechanics({
    id: 'consent-and-bias',
    enemyKinds: ['consent-claw', 'bias-scanner'],
    blindEvent: 'privacy-exposed',
    lesson: '정확도 하나가 아니라 동의 범위와 집단별 오류를 먼저 확인한다.',
    tracePrompt: 'TRACE로 열람 권한과 집단별 오류를 확인',
    bossPhases: [
      ['consent-scope', '동의 범위', 'consent-sweep', '수집에 동의한 범위만 남겨라.'],
      ['group-errors', '집단별 오류', 'bias-grid', '평균에 가려진 오판을 대조하라.'],
      ['h17-lock', 'H-17 삭제 잠금', 'delete-lock', '삭제 요청과 위험 판정을 분리하라.']
    ]
  }),
  'chapter-2': mechanics({
    id: 'credit-and-authenticity',
    enemyKinds: ['copycat-lens', 'forgery-mimic'],
    blindEvent: 'signal-copied',
    lesson: '제작 이력과 최초 파일을 지우면 빼앗긴 공격이 복제되어 돌아온다.',
    tracePrompt: 'TRACE로 제작자·원본 해시를 표시한 뒤 SIGNAL',
    bossPhases: [
      ['creator-credit', '제작자 표시', 'copied-signal', '누가 만들고 AI가 무엇을 도왔는지 밝혀라.'],
      ['origin-hash', '최초 파일', 'deepfake-swap', '복제본 사이에서 최초 해시를 찾아라.'],
      ['altered-frames', '변조 프레임', 'credit-collapse', '변조 구간과 생성 표시를 봉인하라.']
    ]
  }),
  'chapter-3': mechanics({
    id: 'footprint-and-repair',
    enemyKinds: ['echo-relay', 'reaction-swarm'],
    blindEvent: 'spread-amplified',
    lesson: '직접 쓰지 않은 반응과 재공유도 추천을 밀어 피해를 키운다.',
    tracePrompt: 'TRACE로 전달 경로를 얼린 뒤 SIGNAL로 연결을 끊기',
    bossPhases: [
      ['first-post', '최초 게시물', 'echo-pulse', '잘린 장면의 앞뒤 맥락을 복구하라.'],
      ['recommendation', '추천 증폭', 'recommend-rain', '반응이 만든 확산 고리를 멈춰라.'],
      ['harm-notice', '피해 통지', 'harm-wave', '삭제 뒤 피해자에게 회복 경로를 연결하라.']
    ]
  }),
  'chapter-4': mechanics({
    id: 'source-pairing',
    enemyKinds: ['warm-bubble', 'cold-bubble'],
    blindEvent: 'source-pair-incomplete',
    lesson: '추천된 한쪽 화면만으로 결론 내리지 않고 반대 출처와 날짜를 함께 본다.',
    tracePrompt: '서로 연결된 따뜻한 출처와 차가운 반증을 모두 TRACE',
    bossPhases: [
      ['warm-source', '따뜻한 기록', 'warm-wall', '잘린 날짜와 최초 게시자를 확인하라.'],
      ['cold-source', '차가운 반증', 'cold-wall', '반대 자료의 누락도 확인하라.'],
      ['timeline', '시간순서', 'cross-check', '두 자료를 한 시간선에서 교차 검증하라.']
    ]
  }),
  'chapter-5': mechanics({
    id: 'human-review',
    enemyKinds: ['approval-stamp', 'score-clerk'],
    blindEvent: 'automatic-approval',
    lesson: 'AI 추천은 결정이 아니며 중요한 제재에는 이름 있는 사람의 검토가 필요하다.',
    tracePrompt: '날아오는 결재탄을 TRACE로 검토한 뒤 SIGNAL로 반송',
    bossPhases: [
      ['model-role', 'AI 추천', 'model-stamp', '추천의 자료 범위와 불확실성을 확인하라.'],
      ['human-signature', '사람의 승인', 'signature-barrage', '최종 승인자의 확인 기록을 찾아라.'],
      ['appeal-window', '이의제기 창구', 'appeal-clock', '3초 자동 결재를 멈추고 재검토를 열어라.']
    ]
  }),
  'chapter-6': mechanics({
    id: 'explanation-and-appeal',
    enemyKinds: ['whiteout-shard', 'chain-scrambler'],
    blindEvent: 'responsibility-chain-reset',
    lesson: '결정 결과뿐 아니라 계산·승인·실행의 책임 경로와 이의제기 기회를 남긴다.',
    tracePrompt: '책임 기록을 TRACE하고 시간순서대로 SIGNAL 연결',
    bossPhases: [
      ['lumen-score', '루멘 계산', 'score-fragments', '계산 근거와 한계를 공개하라.'],
      ['human-approval', '사람 승인', 'approval-chain', '승인한 사람의 책임을 연결하라.'],
      ['dot-execution', '도트 실행', 'whiteout-chain', '실행 기록 뒤 하루의 이의제기를 복구하라.']
    ],
    chainSteps: ['lumen-score', 'human-approval', 'dot-execution', 'haru-request']
  })
});

const DECISION_MODIFIERS = Object.freeze({
  'protect-context': 'privacy-mask',
  'open-raw': 'restricted-original',
  'remove-and-notify': 'spread-warning',
  'label-and-freeze': 'origin-label',
  'notify-and-repair': 'recovery-route',
  'quiet-freeze': 'consent-window',
  'paired-sources': 'paired-view',
  'open-recommendation-path': 'recommendation-audit',
  'human-review': 'reviewer-present',
  'appeal-first': 'appeal-open'
});

export function deriveCampaignModifiers(decisions = {}) {
  return Object.values(decisions)
    .map((choiceId) => DECISION_MODIFIERS[choiceId])
    .filter(Boolean);
}

export function getChapterMechanics(chapterId) {
  return CAMPAIGN_MECHANICS[chapterId];
}
