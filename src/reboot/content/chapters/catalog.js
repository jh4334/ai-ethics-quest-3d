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
  // 시나리오 v2 대본 — 장면(원룸 조사)의 동사 3단에 맞춘 무전. docs/reboot/시나리오-v2.md가 정본.
  sceneScript: {
    briefing: [
      { speaker: 'DOT', textKo: '축제 영상이 1분에 마흔 번 복제되고 있어. 전부 웃는 얼굴이야.', durationMs: 4300 },
      { speaker: '하루·녹음', textKo: '복사본은 아무리 베어도 늘어. 먼저 원본 시간을 찾아.', durationMs: 4100 }
    ],
    stepCues: [
      { speaker: 'DOT', textKo: '봐, 공유 명령이 그대로 되돌아가. 사슬은 양방향이야.', durationMs: 3800 },
      { speaker: 'DOT', textKo: '최초 업로드, 00시 09분. …축제가 끝나기도 전이야.', durationMs: 4100 },
      { speaker: 'DOT', textKo: '사슬이 끊겼어. 복사는 멎었어 — 원본 경로도 같이 흔들려.', durationMs: 4300 }
    ],
    reversalScript: [
      { speaker: '하루·녹음', textKo: '맞아, 내가 올렸어. 감사 기록은 지워져도 소문은 못 지우니까.', durationMs: 4700 },
      { speaker: 'DOT', textKo: '…미끼였어. 하루는 지워질 걸 알고 있었어.', durationMs: 3900 }
    ]
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
  sceneScript: {
    briefing: [
      { speaker: 'DOT', textKo: '추천 시스템이 학교를 두 장으로 나눴어. 너한테 편한 쪽만 보여줄 거야.', durationMs: 4600 },
      { speaker: '하루·녹음', textKo: '편한 쪽엔 내 이름이 없어. 불편한 쪽에 로그가 있어.', durationMs: 4100 }
    ],
    stepCues: [
      { speaker: 'DOT', textKo: '여긴 삭제 로그가 「정리 완료」로만 보여. 깨끗해서 수상해.', durationMs: 4100 },
      { speaker: 'DOT', textKo: '같은 시각, 실행 명령 D-77. …이 번호, 내 거야.', durationMs: 4100 },
      { speaker: 'DOT', textKo: '두 학교가 겹쳐졌어. 이제 한 장짜리 진실만 남아.', durationMs: 3900 }
    ],
    reversalScript: [
      { speaker: 'DOT', textKo: '실행자는 나였어. 00:16:51. 「학생 보호」 사유로, 동의 없이.', durationMs: 4700 },
      { speaker: '하루·녹음', textKo: 'DOT 잘못만은 아니야. 걔한텐 명령이었어. 누가 명령했는지 봐.', durationMs: 4500 }
    ]
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
  sceneScript: {
    briefing: [
      { speaker: 'LUMEN', textKo: '본 라인의 평균 처리 시간은 3초입니다. 분쟁 0건. 목표 달성.', durationMs: 4300 },
      { speaker: '윤서', textKo: '…네가 왜 여기까지 왔어. 이 라인은 내가 승인했어. 확산을 막으려고.', durationMs: 4700 }
    ],
    stepCues: [
      { speaker: 'DOT', textKo: '되돌리니까 검토 창이 다시 열려. 3초가 아니라 3일도 볼 수 있었어.', durationMs: 4500 },
      { speaker: 'DOT', textKo: 'LUMEN 점수 산식이야. 시끄러운 기록일수록 삭제 우선순위가 올라가.', durationMs: 4500 },
      { speaker: '윤서', textKo: '라인이 섰어. …긴급 지원 기록까지 같이 멈췄어. 이게 정지의 값이야.', durationMs: 4700 }
    ],
    reversalScript: [
      { speaker: '윤서', textKo: '마지막 확인 버튼은 자동이 아니야. 그날 그 버튼, 네 화면에 떴어.', durationMs: 4700 },
      { speaker: 'DOT', textKo: '00:16:43. 네가 눌렀어. 검토 자료 없이 — 우리 모두가 그렇게 눌러.', durationMs: 4900 }
    ]
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
  sceneScript: {
    briefing: [
      { speaker: 'LUMEN', textKo: '보호 프로토콜 가동. 미검증 방송은 학생 보호 위반입니다.', durationMs: 4100 },
      { speaker: 'DOT', textKo: 'LUMEN 말이 완전히 틀린 건 아니야. 그래서 네 손으로 증명해야 해.', durationMs: 4500 },
      { speaker: '하루', textKo: '왔구나. …생각보다 멀쩡하지? 자, 마지막 문제야.', durationMs: 4100 }
    ],
    stepCues: [
      { speaker: '하루', textKo: '보호막이 네 검증 기록을 읽고 있어. 되돌려서 보여줘.', durationMs: 4100 },
      { speaker: 'DOT', textKo: '동의 표식이 있는 기록만 콘솔에 올라가. 네가 모은 그대로야.', durationMs: 4300 },
      { speaker: '하루', textKo: '중계 릴레이 사이를 지나. 멈추면 대기열이 닫혀.', durationMs: 3900 },
      { speaker: '하루', textKo: '이제 스위치는 물리적이야. 옛날 방식. 네 손.', durationMs: 3900 }
    ],
    endings: {
      'redacted-broadcast': [
        { speaker: '하루', textKo: '이름은 가리고 사실은 켰네. 내일 회의는 시끄럽겠다 — 좋은 쪽으로.', durationMs: 4900 },
        { speaker: 'LUMEN', textKo: '이의제기 절차 1건 신설. 목표를 재정의합니다.', durationMs: 3900 }
      ],
      'raw-disclosure': [
        { speaker: '하루', textKo: '전부 보였어. 나도, 걔들도. …각오는 했었어.', durationMs: 4100 },
        { speaker: 'DOT', textKo: '사실과 상처가 같이 방송됐어. 둘 다 기록할게.', durationMs: 3900 }
      ],
      'sealed-incident': [
        { speaker: '하루', textKo: '…오늘은 여기까지. 다음에 열 사람을 위해 상자에 라벨은 붙여 두자.', durationMs: 4900 },
        { speaker: 'LUMEN', textKo: '보관 처리 완료. 검토 일정: 미정.', durationMs: 3400 }
      ]
    },
    epilogue: [
      { speaker: 'DOT', textKo: '동의 없는 삭제 권한을 반납할게. 다음 밤엔, 물어보고 움직일 거야.', durationMs: 4900 }
    ]
  },
  timeline: { desktopMinutes: 34, touchMinutes: 35, chapterSelectMinutes: 33 }
});

export const CHAPTERS_4_5 = deepFreeze([CHAPTER_FOUR, CHAPTER_FIVE]);
export const CHAPTERS_2_5 = deepFreeze([...CHAPTERS_2_3, ...CHAPTERS_4_5]);
