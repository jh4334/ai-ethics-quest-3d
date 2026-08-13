import { recordEvidenceOutcome, setChapterCheckpoint, updateCharacterTrust } from '../state/consequences.js';
import { deepFreeze, normalizeRebootState } from '../state/model.js';

const CHAPTER_RESULTS = deepFreeze({
  2: {
    evidenceId: 'original-upload-trace',
    nextCheckpoint: 'chapter-3:start',
    trustCharacter: 'haru',
    secure: { trust: 8, summaryKo: '공유 사슬을 끊고 최초 업로드 경로를 보존했다.' },
    purge: { trust: -3, summaryKo: '확산을 빠르게 막았지만 최초 업로드 경로도 끊겼다.' }
  },
  3: {
    evidenceId: 'dot-deletion-log',
    nextCheckpoint: 'chapter-4:start',
    trustCharacter: 'dot',
    secure: { trust: -5, summaryKo: '불리한 현실까지 대조해 DOT의 삭제 실행 로그를 보존했다.' },
    purge: { trust: 4, summaryKo: '편한 현실을 유지했지만 삭제 로그 일부가 사라졌다.' }
  },
  4: {
    evidenceId: 'support-record',
    nextCheckpoint: 'chapter-5:start',
    trustCharacter: 'yoonseo',
    secure: { trust: 5, summaryKo: '긴급 지원 기록을 분리 보존하고 승인 경로를 중단했다.' },
    purge: { trust: -4, summaryKo: '3초 승인 경로를 즉시 닫았지만 지원 기록도 함께 닫혔다.' }
  },
  5: {
    evidenceId: 'verified-package',
    nextCheckpoint: 'chapter-6:broadcast-room',
    trustCharacter: 'haru',
    secure: { trust: 6, summaryKo: '동의와 가림 표식을 검증해 방송 패키지를 보존했다.' },
    purge: { trust: -2, summaryKo: '노출 위험을 줄였지만 검증된 증언 일부도 패키지에서 제외했다.' }
  }
});

export function completeCampaignChapter(seed, chapter, action) {
  const current = normalizeRebootState(seed);
  const definition = CHAPTER_RESULTS[chapter];
  if (!definition || current.chapterProgress.current !== chapter || !['secure', 'purge'].includes(action)) {
    throw new RangeError('현재 장과 일치하는 SECURE 또는 PURGE 결과가 필요합니다.');
  }
  let state = recordEvidenceOutcome(current, {
    action,
    chapter,
    evidenceId: definition.evidenceId
  });
  state = updateCharacterTrust(state, definition.trustCharacter, definition[action].trust);
  state = setChapterCheckpoint(state, chapter + 1, definition.nextCheckpoint);
  return deepFreeze({
    action,
    state,
    summaryKo: definition[action].summaryKo
  });
}
