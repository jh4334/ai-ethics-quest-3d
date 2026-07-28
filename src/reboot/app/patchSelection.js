import { resolveBossVictory } from '../bosses/rewards.js';

export function createPatchSelector({ bossGame, bossOptions, canvas, story, storyOptions }) {
  return (patchId) => {
    if (!bossGame || bossGame.getState().status !== 'victory') return false;
    const reward = resolveBossVictory(story.getState().campaign, bossGame.getState(), patchId);
    storyOptions.persist?.(reward.state);
    bossOptions.onPatchResolved?.();
    canvas.dataset.patchChoice = patchId;
    canvas.dataset.savedChapter = String(reward.state.chapterProgress.current);
    canvas.dataset.savedEvidenceCount = String(reward.state.evidence.length);
    return reward;
  };
}
