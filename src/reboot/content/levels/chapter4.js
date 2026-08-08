import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterFourLevel = createLinearSchoolLevel({
  bossExitId: 'chapter-four-complete',
  id: 'chapter-four-three-second-approval',
  segments: [
    {
      color: '#d74732', geometryId: 'approval-intake', id: 'approval-intake',
      interactionId: 'inspect-deletion-output', kind: 'reverse-gate', label: '삭제 출력 접수구', width: 7
    },
    {
      anchorX: -2, color: '#f3b36c', geometryId: 'conveyor-scoring', id: 'scoring-conveyor',
      interactionId: 'reflect-scoring-conveyor', kind: 'arena', label: '3초 점수 컨베이어',
      phaseBeats: ['exploration', 'encounter'], width: 9
    },
    {
      anchorX: 2, color: '#5de0c1', geometryId: 'approval-trace', id: 'approval-trace-room',
      interactionId: 'trace-approval-command', kind: 'decision', label: '승인 명령 추적실',
      phaseBeats: ['clue', 'mid-challenge'], width: 8
    },
    {
      color: '#6aa9ff', geometryId: 'emergency-archive', id: 'emergency-support-archive',
      interactionId: 'open-emergency-archive', kind: 'boss-arena', label: '긴급 지원 기록고',
      phaseBeats: ['consequence', 'boss-escape'],
      sideEffectId: 'approval-delay-exposes-support-record', width: 12
    }
  ]
});
