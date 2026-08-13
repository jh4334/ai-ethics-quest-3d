import { normalizeRebootState } from '../state/model.js';

const SCENES = Object.freeze({
  1: 'school-night',
  2: 'campaign-chapter-2',
  3: 'campaign-chapter-3',
  4: 'campaign-chapter-4',
  5: 'campaign-chapter-5',
  6: 'final-broadcast'
});

export function resolveCampaignSceneId(seed) {
  return SCENES[normalizeRebootState(seed).chapterProgress.current];
}
