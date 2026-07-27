import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINAL_CORE_MISSION,
  SHRINES,
  applyShrineResult,
  completeFinalCore,
  createInitialProgress,
  evaluateShrineChoice,
  getNextObjective
} from '../src/worldData.js';

test('shrine trials award the promise tool (not the fragment — that comes from the main quest)', () => {
  const initial = createInitialProgress();
  const shrine = SHRINES[0];
  const correctChoice = shrine.choices.find((choice) => choice.correct);

  const first = applyShrineResult(initial, shrine.id, correctChoice.id);
  const second = applyShrineResult(first.progress, shrine.id, correctChoice.id);

  assert.deepEqual(initial.tools, []);
  assert.equal(first.result.correct, true);
  assert.equal(first.toolId, 'shield');
  assert.deepEqual(first.progress.tools, ['shield']);
  assert.deepEqual(first.progress.collectedFragments, [], 'shrine gives the tool, not the fragment');
  assert.deepEqual(second.progress.tools, ['shield']);
  assert.deepEqual(second.progress.completedShrines, [shrine.id]);
});

test('incorrect shrine answer records the visit but does not award a fragment', () => {
  const initial = createInitialProgress();
  const shrine = SHRINES[1];
  const incorrectChoice = shrine.choices.find((choice) => !choice.correct);

  const outcome = applyShrineResult(initial, shrine.id, incorrectChoice.id);

  assert.equal(outcome.result.correct, false);
  assert.deepEqual(outcome.progress.visitedTopics, [shrine.topicId]);
  assert.deepEqual(outcome.progress.collectedFragments, []);
});

test('unknown shrine choices fail loudly for deterministic classroom content', () => {
  assert.throws(
    () => evaluateShrineChoice(SHRINES[0].id, 'not-a-real-choice'),
    /Unknown choice/
  );
});

test('final AI Core requires unlock progress and completes on the balanced pledge', () => {
  const locked = completeFinalCore(createInitialProgress(), FINAL_CORE_MISSION.choices[1].id);
  assert.equal(locked.unlocked, false);

  const readyProgress = {
    ...createInitialProgress(),
    collectedFragments: ['privacy', 'bias', 'copyright']
  };
  const outcome = completeFinalCore(readyProgress, 'balanced-promise');

  assert.equal(outcome.unlocked, true);
  assert.equal(outcome.result.correct, true);
  assert.equal(outcome.progress.aiCoreCompleted, true);
  assert.match(getNextObjective(outcome.progress), /활동지/);
});

