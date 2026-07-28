import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterThreeLevel = createLinearSchoolLevel({
  bossExitId: 'chapter-three-complete',
  id: 'chapter-three-dual-school',
  segments: [
    { color: '#f3b36c', id: 'comfort-entrance', kind: 'layer-gate', label: '편한 현실 입구', width: 5 },
    { color: '#d74732', id: 'split-courtyard', kind: 'dual-arena', label: '갈라진 교정', width: 10 },
    { color: '#5de0c1', id: 'verified-archive', kind: 'decision', label: '검증 현실 기록실', width: 6 },
    { color: '#6aa9ff', id: 'recommendation-core', kind: 'boss-arena', label: '추천 코어', width: 12 }
  ]
});
