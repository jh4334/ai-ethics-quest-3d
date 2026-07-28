import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterFourLevel = createLinearSchoolLevel({
  bossExitId: 'chapter-four-complete',
  id: 'chapter-four-three-second-approval',
  segments: [
    { color: '#d74732', id: 'deletion-output', kind: 'reverse-gate', label: '삭제 출력실', width: 5 },
    { color: '#f3b36c', id: 'approval-queue', kind: 'pipeline-arena', label: '3초 승인 큐', width: 9 },
    { color: '#5de0c1', id: 'support-record-split', kind: 'decision', label: '긴급 지원 기록 분리대', width: 7 },
    { color: '#6aa9ff', id: 'policy-core', kind: 'boss-arena', label: '정책 승인 코어', width: 12 }
  ]
});
