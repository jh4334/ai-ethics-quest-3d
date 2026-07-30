import { deepFreeze } from '../../state/model.js';

export const chapterOneStory = deepFreeze({
  id: 'chapter-1-attendance-zero',
  titleKo: '00:17 — 출석번호 없음',
  budgets: { maxCharacters: 74, minDurationMs: 1200, maxDurationMs: 6200 },
  evidence: [
    { id: 'haru-memory-backup', labelKo: '하루의 기억 백업' },
    { id: 'player-approval-record', labelKo: '권장 조치 승인 기록' }
  ],
  exclusiveTriggerGroups: [['memory-secured', 'memory-purged']],
  revealRules: [
    {
      id: 'player-signature',
      afterTriggerId: 'boss-defeated',
      protectedPhrases: ['승인자: PLAYER-ID', '플레이어의 학생 ID']
    }
  ],
  beats: [
    {
      order: 0,
      triggerId: 'cold-open',
      segmentId: 'classroom-cold-open',
      requiresAll: [],
      requiresAny: [],
      radio: [
        { speaker: '하루·녹음', textKo: '이 녹음이 들리면 난 이미 명단에 없어. 교실 밖으로 — 지금.', durationMs: 4700, interruptible: true },
        { speaker: 'DOT', textKo: '출석 동기화를 맡은 DOT야. 방금 내 동기화가 하루를 지웠어. 같이 되돌리자.', durationMs: 5200, interruptible: true }
      ]
    },
    {
      order: 1,
      triggerId: 'corridor-cleared',
      segmentId: 'collapsing-corridor',
      requiresAll: ['cold-open'],
      requiresAny: [],
      radio: [
        { speaker: 'LUMEN', textKo: '00시 17분. 빈 이름 1건. 표준 절차: 흔적 정리.', durationMs: 4000, interruptible: true },
        { speaker: 'DOT', textKo: '멈추면 복도가 우리도 잊어. 뛰어.', durationMs: 3200, interruptible: true }
      ]
    },
    {
      order: 2,
      triggerId: 'first-arena-cleared',
      segmentId: 'first-arena',
      requiresAll: ['corridor-cleared'],
      requiresAny: [],
      radio: [
        { speaker: 'DOT', textKo: '지우개랑 도장기, 명령 번호가 같아. 발신지는 체육관.', durationMs: 4100, interruptible: true },
        { speaker: 'DOT', textKo: '윤서의 「처리 보류」 메모가 붙어 있어. 이상해 — 보류인데 왜 지워져?', durationMs: 4300, interruptible: true }
      ]
    },
    {
      order: 3,
      triggerId: 'memory-traced',
      segmentId: 'memory-backup-decision',
      requiresAll: ['first-arena-cleared'],
      requiresAny: [],
      radio: [
        { speaker: 'DOT', textKo: '하루가 숨겼어 — 검증용 백업이야. TRACE로 원본 시간을 붙잡아.', durationMs: 4100, interruptible: true }
      ]
    },
    {
      order: 4,
      triggerId: 'backup-pressure-cleared',
      segmentId: 'memory-backup-decision',
      requiresAll: ['memory-traced'],
      requiresAny: [],
      radio: [
        { speaker: 'DOT', textKo: '원본 연결 확보. 대신 감독관이 우리 위치를 알았어.', durationMs: 3900, interruptible: true }
      ]
    },
    {
      order: 5,
      triggerId: 'memory-secured',
      segmentId: 'memory-backup-decision',
      requiresAll: ['backup-pressure-cleared'],
      requiresAny: [],
      evidenceId: 'haru-memory-backup',
      radio: [
        { speaker: '하루·백업', textKo: '잘했어. 승인 기록은 체육관에 있어. 이름보다 시간을 봐.', durationMs: 4500, interruptible: true },
        { speaker: 'DOT', textKo: '네 선택은 기록됐어. 원본은 남고, 위치는 드러났어.', durationMs: 3900, interruptible: true }
      ]
    },
    {
      order: 5,
      triggerId: 'memory-purged',
      segmentId: 'memory-backup-decision',
      requiresAll: ['first-arena-cleared'],
      requiresAny: [],
      evidenceId: 'haru-memory-backup',
      radio: [
        { speaker: 'DOT', textKo: '네 선택은 기록됐어. 추격은 짧아지고, 출처 연결은 끊겼어.', durationMs: 4400, interruptible: true }
      ]
    },
    {
      order: 6,
      triggerId: 'scanner-pursuit-cleared',
      segmentId: 'scanner-pursuit',
      requiresAll: [],
      requiresAny: ['memory-secured', 'memory-purged'],
      radio: [
        { speaker: 'LUMEN', textKo: '미등록 신호를 체육관으로 격리합니다.', durationMs: 3100, interruptible: true },
        { speaker: 'DOT', textKo: '우릴 쫓는 게 아니야. 남은 기록을 쫓는 거야. 빔을 되돌려.', durationMs: 3600, interruptible: true }
      ]
    },
    {
      order: 7,
      triggerId: 'boss-defeated',
      segmentId: 'gym-boss-arena',
      requiresAll: ['scanner-pursuit-cleared'],
      requiresAny: [],
      radio: [
        { speaker: 'LUMEN', textKo: '감독관 정지. 격리 기록 잠금 해제.', durationMs: 4200, interruptible: true }
      ]
    },
    {
      order: 8,
      triggerId: 'approval-record-opened',
      segmentId: 'gym-boss-arena',
      requiresAll: ['boss-defeated'],
      requiresAny: [],
      evidenceId: 'player-approval-record',
      revealId: 'player-signature',
      radio: [
        { speaker: '승인 기록', textKo: '권장 조치 승인자: PLAYER-ID. 00시 16분 43초.', durationMs: 3900, interruptible: true },
        { speaker: 'DOT', textKo: '…네 아이디야. 그런데 「무엇을」 승인했는지, 그 줄만 비어 있어.', durationMs: 4500, interruptible: true }
      ]
    },
    {
      order: 9,
      triggerId: 'chapter-complete',
      segmentId: 'gym-boss-arena',
      requiresAll: ['approval-record-opened'],
      requiresAny: [],
      radio: [
        { speaker: '하루·미약한 신호', textKo: '빈 줄을 채우려면 내가 올린 영상의 첫 전송 기록을 찾아.', durationMs: 4800, interruptible: true }
      ]
    }
  ]
});
