import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCampaignSceneId } from '../src/reboot/app/campaignSceneRouting.js';
import { completeCampaignChapter } from '../src/reboot/campaign/chapterProgression.js';
import { setChapterCheckpoint } from '../src/reboot/state/consequences.js';
import { createInitialRebootState } from '../src/reboot/state/model.js';

test('Given valid checkpoints, When routing chapters one through six, Then each chapter has one production scene', () => {
  // Given
  const state = createInitialRebootState();

  // When
  const sceneIds = Array.from({ length: 6 }, (_, index) => {
    const chapter = index + 1;
    return resolveCampaignSceneId(setChapterCheckpoint(state, chapter, `chapter-${chapter}:start`));
  });

  // Then
  assert.deepEqual(sceneIds, [
    'school-night',
    'campaign-chapter-2',
    'campaign-chapter-3',
    'campaign-chapter-4',
    'campaign-chapter-5',
    'final-broadcast'
  ]);
});

test('Given chapter four completion, When chapter five is completed, Then verified package advances to chapter six', () => {
  // Given
  const chapterFour = setChapterCheckpoint(createInitialRebootState(), 4, 'chapter-4:start');
  const chapterFive = completeCampaignChapter(chapterFour, 4, 'secure').state;

  // When
  const chapterSix = completeCampaignChapter(chapterFive, 5, 'secure').state;

  // Then
  assert.deepEqual(chapterFive.chapterProgress, {
    completed: [1, 2, 3, 4], current: 5, checkpoint: 'chapter-5:start'
  });
  assert.deepEqual(chapterSix.chapterProgress, {
    completed: [1, 2, 3, 4, 5], current: 6, checkpoint: 'chapter-6:broadcast-room'
  });
  assert.deepEqual(chapterSix.evidence.map(({ evidenceId }) => evidenceId), [
    'support-record', 'verified-package'
  ]);
  assert.equal(resolveCampaignSceneId(chapterSix), 'final-broadcast');
});

test('Given a six-chapter state, When chapter seven is requested, Then validation rejects it', () => {
  // Given
  const state = createInitialRebootState();

  // When
  const setChapterSeven = () => setChapterCheckpoint(state, 7, 'chapter-7:start');

  // Then
  assert.throws(setChapterSeven, RangeError);
});
