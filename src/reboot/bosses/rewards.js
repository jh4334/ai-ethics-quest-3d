import { choosePatch, recordEvidenceOutcome, setChapterCheckpoint } from '../state/consequences.js';

function frozenResult(state, events) {
  return Object.freeze({ state, events: Object.freeze(events.map((event) => Object.freeze(event))) });
}

export function resolveBossVictory(saveState, bossState, patchId) {
  if (bossState?.status !== 'victory') throw new Error('출석 감독관 승리 상태가 필요합니다.');
  const alreadyCompleted = saveState.chapterProgress?.completed?.includes(1);
  if (alreadyCompleted) {
    if (saveState.patchChoice !== patchId) throw new Error('이미 다른 PATCH가 확정되었습니다.');
    return frozenResult(saveState, []);
  }
  const patched = choosePatch(saveState, patchId);
  const evidenced = recordEvidenceOutcome(patched, {
    action: 'secure',
    chapter: 1,
    evidenceId: 'player-approval-record'
  });
  const completed = setChapterCheckpoint(evidenced, 2, 'chapter-2:start');
  return frozenResult(completed, [
    { patchId, type: 'patch-awarded' },
    { chapter: 1, type: 'chapter-completed' }
  ]);
}
