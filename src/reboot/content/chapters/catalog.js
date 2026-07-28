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

export const CHAPTER_FOUR = deepFreeze({
  id: 'chapter-4-three-second-approval',
  order: 4,
  titleKo: '3초 승인실',
  loop: {
    decision: 'inspect-and-reverse-approval-pipeline',
    steps: ['read-deletion', 'reverse-approval', 'trace-score', 'preserve-or-shutdown'],
    targetSeconds: 30
  },
  enemyIds: ['approval'],
  evidenceId: 'support-record',
  carryover: {
    secure: {
      encounterVariant: 'full-audit-pressure', evidenceAccess: 'timed-support-log',
      dialogueCue: '보존한 로그가 3초 승인 큐의 순서를 복원한다.',
      advantage: '승인 단계를 한 번 건너뛰어 역추적한다.', cost: '승인관 증원 하나가 보존 로그를 추격한다.'
    },
    purge: {
      encounterVariant: 'reconstructed-approval', evidenceAccess: 'fragmented-support-log',
      dialogueCue: '사라진 구간을 승인관의 응답 시간으로 역산한다.',
      advantage: '보존 로그를 노리는 증원이 없다.', cost: '지원 기록을 세 단말에서 다시 대조해야 한다.'
    }
  },
  consequenceEchoes: [
    { id: 'support-records', secureKo: '긴급 지원 기록을 분리해 남겼다.', purgeKo: '빠른 중단과 함께 지원 기록도 닫혔다.' },
    { id: 'approval-memory', secureKo: '플레이어가 누른 승인 시각이 온전히 돌아왔다.', purgeKo: '승인 기억은 복구됐지만 당시 검토 자료는 비어 있다.' }
  ],
  boss: {
    id: 'approval-pipeline',
    phases: [
      { id: 'reverse-delete', response: 'reflect' },
      { id: 'trace-score', response: 'trace' },
      { id: 'break-approval', response: 'attack' }
    ]
  },
  patchReward: { id: 'approval-rewind', verb: 'reflect', effect: 'one rejected command returns to its review window' },
  reversal: {
    foreshadowIds: ['three-second-target', 'yoonseo-policy-signature'],
    revealId: 'linked-human-approval',
    textKo: '윤서의 정책 승인과 플레이어가 누른 버튼이 같은 삭제 경로에 연결돼 있었다.'
  },
  timeline: { desktopMinutes: 31, touchMinutes: 33, chapterSelectMinutes: 30 }
});

export const CHAPTER_FIVE = deepFreeze({
  id: 'chapter-5-final-broadcast',
  order: 5,
  titleKo: '마지막 방송',
  loop: {
    decision: 'master-protection-protocol-before-broadcast',
    steps: ['reflect-shield', 'trace-consent', 'dash-relay', 'signal-core'],
    targetSeconds: 30
  },
  enemyIds: [],
  evidenceId: 'broadcast-queue',
  carryover: {
    secure: {
      encounterVariant: 'protected-record-route', evidenceAccess: 'redaction-console',
      dialogueCue: '보존한 기록이 방송 대기열에서 가림 처리 후보로 묶인다.',
      advantage: '보호 프로토콜의 활성 창이 길어진다.', cost: '검증할 보호 기록이 한 묶음 더 남는다.'
    },
    purge: {
      encounterVariant: 'missing-context-route', evidenceAccess: 'raw-or-seal-console',
      dialogueCue: '누락된 기록 때문에 방송 대기열이 원본 공개와 봉인으로 갈라진다.',
      advantage: '검토할 기록 묶음이 적다.', cost: '보호 프로토콜의 활성 창이 짧아진다.'
    }
  },
  consequenceEchoes: [
    { id: 'haru-return', secureKo: '하루가 가림 검증본에 직접 설명을 덧붙인다.', purgeKo: '하루가 빠진 맥락을 방송 전 직접 경고한다.' },
    { id: 'dot-limit', secureKo: 'DOT가 동의 없는 삭제를 멈추는 제한을 받아들인다.', purgeKo: 'DOT의 삭제 권한은 검토가 끝날 때까지 봉인된다.' }
  ],
  boss: {
    id: 'lumen-dot-protection-protocol',
    phases: [
      { id: 'reflect-shield', response: 'reflect' },
      { id: 'trace-consent', response: 'trace' },
      { id: 'dash-relay', response: 'dash' },
      { id: 'signal-core', response: 'attack' }
    ]
  },
  patchReward: { id: 'consent-window', verb: 'trace', effect: 'verified consent stays visible at the broadcast console' },
  reversal: {
    foreshadowIds: ['broadcast-waiting-list', 'shared-decision-path'],
    revealId: 'responsibility-is-a-chain',
    textKo: '삭제는 한 명의 명령이 아니라 점수·정책·승인·실행이 이어진 결정 경로였다.'
  },
  timeline: { desktopMinutes: 34, touchMinutes: 35, chapterSelectMinutes: 33 }
});

export const CHAPTERS_4_5 = deepFreeze([CHAPTER_FOUR, CHAPTER_FIVE]);
export const CHAPTERS_2_5 = deepFreeze([...CHAPTERS_2_3, ...CHAPTERS_4_5]);
