import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterSixLevel = createLinearSchoolLevel({
  bossExitId: 'campaign-resolved',
  id: 'chapter-six-final-broadcast',
  segments: [
    { color: '#6aa9ff', id: 'broadcast-entry', kind: 'broadcast-entry', label: '방송국 진입로', width: 6 },
    { color: '#f3b36c', id: 'protection-relay', kind: 'protection-relay', label: 'LUMEN·DOT 보호 릴레이', width: 8 },
    { color: '#5de0c1', id: 'transmission-bridge', kind: 'transmission-bridge', label: '중계 연결교', width: 7 },
    { color: '#d74732', id: 'final-core', kind: 'final-core', label: '최종 방송 코어', width: 13 }
  ]
});
