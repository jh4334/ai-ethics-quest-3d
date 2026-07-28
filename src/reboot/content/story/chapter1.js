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
        { speaker: '하루·녹음', textKo: 'DOT가 내가 없었다고 말하면, 도망쳐. 출석부보다 복도부터 믿어.', durationMs: 4700, interruptible: true },
        { speaker: 'DOT', textKo: '등록되지 않은 음성입니다. 발신자도 학생도 존재하지 않습니다.', durationMs: 4200, interruptible: true }
      ]
    },
    {
      order: 1,
      triggerId: 'corridor-cleared',
      segmentId: 'collapsing-corridor',
      requiresAll: ['cold-open'],
      requiresAny: [],
      radio: [
        { speaker: 'LUMEN', textKo: '00시 17분. 출석 기록 동기화. 빈 이름을 발견했습니다.', durationMs: 4000, interruptible: true },
        { speaker: 'DOT', textKo: '멈추면 교실도 우리를 잊어. 출구까지 뛰어.', durationMs: 3200, interruptible: true }
      ]
    },
    {
      order: 2,
      triggerId: 'first-arena-cleared',
      segmentId: 'first-arena',
      requiresAll: ['corridor-cleared'],
      requiresAny: [],
      radio: [
        { speaker: 'DOT', textKo: '지우개와 도장기가 같은 명령 번호를 써. 발신지는 체육관이야.', durationMs: 4100, interruptible: true }
      ]
    },
    {
      order: 3,
      triggerId: 'memory-traced',
      segmentId: 'memory-backup-decision',
      requiresAll: ['first-arena-cleared'],
      requiresAny: [],
      radio: [
        { speaker: 'DOT', textKo: '오염 표적 안에서 하루의 백업 신호가 나와. TRACE를 유지해.', durationMs: 4100, interruptible: true }
      ]
    },
    {
      order: 4,
      triggerId: 'backup-pressure-cleared',
      segmentId: 'memory-backup-decision',
      requiresAll: ['memory-traced'],
      requiresAny: [],
      radio: [
        { speaker: 'DOT', textKo: '원본 연결을 붙잡았어. 대신 감독관이 증원을 보냈어.', durationMs: 3600, interruptible: true }
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
        { speaker: '하루·백업', textKo: '승인 기록은 체육관 출석 서버에 따로 남겼어. 이름보다 시간을 봐.', durationMs: 4500, interruptible: true },
        { speaker: 'DOT', textKo: '백업은 남았지만 위치도 드러났어. 스캐너가 이쪽을 본다.', durationMs: 3900, interruptible: true }
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
        { speaker: 'DOT', textKo: '표적 소거 완료. 추격 경로가 짧아졌어. 출처 연결도 끊겼어.', durationMs: 4200, interruptible: true }
      ]
    },
    {
      order: 6,
      triggerId: 'scanner-pursuit-cleared',
      segmentId: 'scanner-pursuit',
      requiresAll: [],
      requiresAny: ['memory-secured', 'memory-purged'],
      radio: [
        { speaker: 'LUMEN', textKo: '미등록 학생 신호를 체육관으로 격리합니다.', durationMs: 3100, interruptible: true },
        { speaker: 'DOT', textKo: '우리가 아니라 남은 기록을 쫓고 있어. 빔을 되돌려.', durationMs: 3600, interruptible: true }
      ]
    },
    {
      order: 7,
      triggerId: 'boss-defeated',
      segmentId: 'gym-boss-arena',
      requiresAll: ['scanner-pursuit-cleared'],
      requiresAny: [],
      radio: [
        { speaker: 'LUMEN', textKo: '출석 감독관 정지. 격리된 승인 기록의 잠금을 해제합니다.', durationMs: 4200, interruptible: true }
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
        { speaker: '승인 기록', textKo: '권장 조치 승인자: PLAYER-ID. 시각 00:16:43.', durationMs: 3900, interruptible: true },
        { speaker: 'DOT', textKo: '네가 누른 승인이다. 그런데 무엇을 승인했는지는 한 줄이 비어 있어.', durationMs: 4500, interruptible: true }
      ]
    },
    {
      order: 9,
      triggerId: 'chapter-complete',
      segmentId: 'gym-boss-arena',
      requiresAll: ['approval-record-opened'],
      requiresAny: [],
      radio: [
        { speaker: '하루·미약한 신호', textKo: '내가 공개한 영상의 첫 전송 기록을 찾아. 그러면 빈 줄이 보일 거야.', durationMs: 4800, interruptible: true }
      ]
    }
  ]
});
