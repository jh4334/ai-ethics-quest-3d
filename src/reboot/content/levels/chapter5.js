import { createLinearSchoolLevel } from './createLinearSchoolLevel.js';

export const chapterFiveLevel = createLinearSchoolLevel({
  bossExitId: 'chapter-five-complete',
  id: 'chapter-five-testimony-archive',
  segments: [
    { color: '#6aa9ff', id: 'testimony-intake', kind: 'archive-intake', label: '증언 접수실', width: 6 },
    { color: '#f3b36c', id: 'consent-redaction-lab', kind: 'redaction-lab', label: '동의·가림 작업실', width: 9 },
    { color: '#5de0c1', id: 'privacy-crosscheck', kind: 'privacy-crosscheck', label: '개인정보 대조실', width: 7 },
    { color: '#d74732', id: 'verification-vault', kind: 'archive-boss', label: '검증 패키지 금고', width: 12 }
  ]
});
