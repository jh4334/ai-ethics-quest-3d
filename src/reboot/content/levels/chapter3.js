import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterThreeLevel = createLinearSchoolLevel({
  bossExitId: 'chapter-three-complete',
  id: 'chapter-three-dual-school',
  segments: [
    {
      color: '#6aa9ff', geometryId: 'split-foyer', id: 'dual-school-foyer',
      interactionId: 'choose-first-school', kind: 'layer-gate', label: '갈라진 학교 입구', width: 8
    },
    {
      anchorX: -4, color: '#f3b36c', geometryId: 'warm-incomplete', id: 'warm-incomplete-school',
      interactionId: 'inspect-incomplete-answer', kind: 'arena', label: '따뜻한 미완성 학교',
      pathId: 'warm-incomplete-path', phaseBeats: ['exploration', 'encounter'], width: 8
    },
    {
      anchorX: 4, color: '#5de0c1', geometryId: 'cold-verified', id: 'cold-verified-school',
      interactionId: 'verify-answer-records', kind: 'decision', label: '차가운 검증 학교',
      pathId: 'cold-verifiable-path', phaseBeats: ['clue', 'mid-challenge'], width: 8
    },
    {
      color: '#d74732', geometryId: 'deletion-archive', id: 'dot-deletion-archive',
      interactionId: 'reveal-dot-deletion', kind: 'boss-arena', label: 'DOT 삭제 기록고',
      phaseBeats: ['consequence', 'boss-escape'], width: 12
    }
  ]
});
