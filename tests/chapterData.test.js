import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_CHAPTERS,
  completeCampaign,
  getCampaignSummary,
  getChapterStates,
  getCurrentChapter
} from '../src/chapterData.js';
import { createInitialProgress } from '../src/worldData.js';
import { markStageCompleted } from '../src/stageData.js';

test('campaign exposes six ordered, distinct chapters with player-facing questions', () => {
  assert.equal(CAMPAIGN_CHAPTERS.length, 6);
  assert.deepEqual(CAMPAIGN_CHAPTERS.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(CAMPAIGN_CHAPTERS.map((chapter) => chapter.id)).size, 6);
  assert.ok(CAMPAIGN_CHAPTERS.every((chapter) => chapter.titleKo && chapter.questionKo && chapter.objectiveKo));
});

test('chapter progression bridges the old island IDs without losing save compatibility', () => {
  let progress = createInitialProgress();
  assert.equal(getCurrentChapter(progress).number, 1);

  progress = { ...progress, collectedFragments: ['privacy', 'bias'] };
  assert.equal(getCurrentChapter(progress).number, 2);

  progress = { ...progress, aiCoreCompleted: true };
  assert.equal(getCurrentChapter(progress).number, 3);

  progress = markStageCompleted(progress, 'whisper-cape');
  assert.equal(getCurrentChapter(progress).number, 4);
  progress = markStageCompleted(progress, 'echo-cave');
  assert.equal(getCurrentChapter(progress).number, 5);
  progress = markStageCompleted(progress, 'hourglass-port');
  assert.equal(getCurrentChapter(progress).number, 6);

  const before = progress;
  progress = completeCampaign(progress);
  assert.equal(before.campaignCompleted, false);
  assert.equal(progress.campaignCompleted, true);
  assert.equal(getCampaignSummary(progress).completed, 6);
  assert.ok(getChapterStates(progress).every((chapter) => chapter.state === 'completed'));
});
