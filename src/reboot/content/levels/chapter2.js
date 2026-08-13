import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterTwoLevel = createLinearSchoolLevel({
  bossExitId: 'chapter-two-complete',
  id: 'chapter-two-smiling-riot',
  segments: [
    {
      color: '#f3b36c', geometryId: 'media-plaza', id: 'media-plaza-arrival',
      interactionId: 'survey-media-plaza', kind: 'pursuit', label: '미디어 광장', width: 7
    },
    {
      anchorX: -2, color: '#d74732', geometryId: 'edit-bays', id: 'copycat-edit-suite',
      interactionId: 'reflect-copycat-edit', kind: 'arena', label: '복제 편집실',
      phaseBeats: ['exploration', 'encounter'], width: 8
    },
    {
      anchorX: 2, color: '#5de0c1', geometryId: 'upload-trace', id: 'original-upload-lab',
      interactionId: 'trace-original-upload', kind: 'decision', label: '최초 업로드 추적실',
      phaseBeats: ['clue', 'mid-challenge'], width: 7
    },
    {
      color: '#6aa9ff', geometryId: 'broadcast-stage', id: 'copycat-broadcast-stage',
      interactionId: 'escape-copycat-broadcast', kind: 'boss-arena', label: '복제 방송 무대',
      phaseBeats: ['consequence', 'boss-escape'], width: 12
    }
  ]
});
