import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterTwoLevel = createLinearSchoolLevel({
  bossExitId: 'chapter-two-complete',
  id: 'chapter-two-smiling-riot',
  segments: [
    { color: '#f3b36c', id: 'share-gate', kind: 'pursuit', label: '축제 공유 관문', width: 5 },
    { color: '#d74732', id: 'copycat-court', kind: 'arena', label: '복사본 운동장', width: 9 },
    { color: '#5de0c1', id: 'origin-vault', kind: 'decision', label: '최초 업로드 보관실', width: 6 },
    { color: '#6aa9ff', id: 'meme-swarm-arena', kind: 'boss-arena', label: '밈 군집 방송실', width: 12 }
  ]
});
