import { resolveCampaignSceneId } from '../app/campaignSceneRouting.js';
import { CHAPTER_COUNT, deepFreeze, normalizeRebootState } from '../state/model.js';

export const CHAPTER_START_CHECKPOINTS = Object.freeze({
  1: 'chapter-1:start',
  2: 'chapter-2:start',
  3: 'chapter-3:start',
  4: 'chapter-4:start',
  5: 'chapter-5:start',
  6: 'chapter-6:broadcast-room'
});

export function buildProductShellModel(seed) {
  const state = normalizeRebootState(seed);
  const { chapterProgress } = state;
  const canContinue = chapterProgress.current !== 1 || chapterProgress.checkpoint !== 'chapter-1:start';
  const chapters = Array.from({ length: CHAPTER_COUNT }, (_, index) => {
    const chapter = index + 1;
    const complete = chapterProgress.completed.includes(chapter);
    const current = chapterProgress.current === chapter;
    return deepFreeze({
      chapter,
      checkpoint: CHAPTER_START_CHECKPOINTS[chapter],
      sceneId: resolveCampaignSceneId({ ...state, chapterProgress: {
        completed: Array.from({ length: chapter - 1 }, (_, completedIndex) => completedIndex + 1),
        current: chapter,
        checkpoint: CHAPTER_START_CHECKPOINTS[chapter]
      } }),
      selectable: complete || current,
      state: complete ? 'complete' : current ? 'current' : 'locked'
    });
  });
  return deepFreeze({ canContinue, chapters });
}
