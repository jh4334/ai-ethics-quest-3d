import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterFiveLevel = createLinearSchoolLevel({
  bossExitId: 'campaign-resolved',
  id: 'chapter-five-final-broadcast',
  segments: [
    { color: '#6aa9ff', id: 'old-stairwell', kind: 'approach', label: '폐쇄된 방송 계단', width: 5 },
    { color: '#f3b36c', id: 'haru-reunion', kind: 'story', label: '하루의 방송 준비실', width: 7 },
    { color: '#5de0c1', id: 'broadcast-queue', kind: 'decision', label: '방송 대기열', width: 8 },
    { color: '#d74732', id: 'protection-protocol', kind: 'boss-arena', label: 'LUMEN·DOT 보호 프로토콜', width: 13 }
  ]
});
