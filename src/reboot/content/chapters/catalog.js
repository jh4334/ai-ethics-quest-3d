function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const CHAPTER_TWO = deepFreeze({
  id: 'chapter-2-smiling-riot',
  order: 2,
  titleKo: '웃는 얼굴의 폭동',
  loop: {
    decision: 'trace-source-before-cutting-share-chain',
    steps: ['reflect-share', 'blade-clone', 'trace-origin', 'secure-or-cut-chain'],
    targetSeconds: 30
  },
  enemyIds: ['copycat'],
  evidenceId: 'original-upload-trace',
  carryover: {
    secure: {
      encounterVariant: 'copycat-overflow', evidenceAccess: 'direct-origin',
      dialogueCue: '백업의 원본 시간이 최초 업로드와 맞물린다.',
      advantage: '최초 업로드 경로가 바로 열린다.', cost: '복사본 증원 한 무리가 더 깨어난다.'
    },
    purge: {
      encounterVariant: 'copycat-thin', evidenceAccess: 'reconstructed-origin',
      dialogueCue: '사라진 백업 대신 공유 시각을 역산해야 한다.',
      advantage: '초기 복사본 수가 적다.', cost: '최초 업로드 시각을 세 구간에서 재구성해야 한다.'
    }
  },
  consequenceEchoes: [
    { id: 'share-chain', secureKo: '원본 연결을 남긴 채 공유 사슬을 잘랐다.', purgeKo: '공유는 빨리 멎었지만 원본 연결도 끊겼다.' },
    { id: 'bystander-exposure', secureKo: '주변 학생 표식은 가려졌다.', purgeKo: '복구를 위해 공개 흔적 두 개가 더 필요해졌다.' }
  ],
  boss: {
    id: 'meme-swarm',
    phases: [
      { id: 'reflect-share', response: 'reflect' },
      { id: 'trace-origin', response: 'trace' },
      { id: 'cut-chain', response: 'attack' }
    ]
  },
  patchReward: { id: 'source-lock', verb: 'trace', effect: 'traced origin stays visible through one clone split' },
  reversal: {
    foreshadowIds: ['scheduled-upload', 'audit-beacon'],
    revealId: 'haru-seeded-incident',
    textKo: '하루는 감사를 남기기 위해 사건을 일부러 공개했다.'
  },
  timeline: { desktopMinutes: 29, touchMinutes: 31, chapterSelectMinutes: 28 }
});

export const CHAPTER_THREE = deepFreeze({
  id: 'chapter-3-dual-school',
  order: 3,
  titleKo: '두 개의 학교',
  loop: {
    decision: 'switch-reality-to-expose-recommender',
    steps: ['read-layer', 'switch-layer', 'trace-bias', 'cross-layer-break'],
    targetSeconds: 30
  },
  enemyIds: ['recommender'],
  evidenceId: 'dot-deletion-log',
  carryover: {
    secure: {
      encounterVariant: 'verified-layer-pressure', evidenceAccess: 'full-deletion-log',
      dialogueCue: '보존한 시간표가 두 현실의 삭제 순서를 맞춘다.',
      advantage: '검증 현실의 문이 즉시 열린다.', cost: '추천자 둘이 동시에 현실을 갈라놓는다.'
    },
    purge: {
      encounterVariant: 'comfort-layer-detour', evidenceAccess: 'split-deletion-log',
      dialogueCue: '누락된 백업 때문에 편한 현실의 우회로를 먼저 탄다.',
      advantage: '첫 추천자와 싸우지 않고 우회한다.', cost: '삭제 로그 조각을 두 현실에서 각각 확보해야 한다.'
    }
  },
  consequenceEchoes: [
    { id: 'verified-route', secureKo: '검증 가능한 교정이 계속 보인다.', purgeKo: '편한 교정이 먼저 열리고 검증 교정은 흔들린다.' },
    { id: 'dot-trust', secureKo: 'DOT가 보존된 시간표를 인정한다.', purgeKo: 'DOT가 누락된 구간을 스스로 설명해야 한다.' }
  ],
  boss: {
    id: 'recommendation-splitter',
    phases: [
      { id: 'layer-shift', response: 'switch-layer' },
      { id: 'trace-bias', response: 'trace' },
      { id: 'cross-layer-break', response: 'attack' }
    ]
  },
  patchReward: { id: 'layer-echo', verb: 'dash', effect: 'dash leaves one safe echo in the opposite layer' },
  reversal: {
    foreshadowIds: ['split-log-a', 'split-log-b'],
    revealId: 'dot-executed-deletion',
    textKo: '하루의 기록 삭제를 직접 실행한 것은 DOT였다.'
  },
  timeline: { desktopMinutes: 30, touchMinutes: 32, chapterSelectMinutes: 29 }
});

export const CHAPTERS_2_3 = deepFreeze([CHAPTER_TWO, CHAPTER_THREE]);
