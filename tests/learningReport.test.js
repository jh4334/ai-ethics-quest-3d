import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHRINES,
  applyShrineResult,
  completeFinalCore,
  createInitialProgress,
  getLearningReport,
  normalizeProgress
} from '../src/worldData.js';

function correctChoice(shrine) {
  return shrine.choices.find((choice) => choice.correct);
}

function incorrectChoice(shrine) {
  return shrine.choices.find((choice) => !choice.correct);
}

test('choice log records every shrine attempt in order without mutating prior progress', () => {
  const initial = createInitialProgress();
  const shrine = SHRINES[0];

  const wrong = applyShrineResult(initial, shrine.id, incorrectChoice(shrine).id);
  const right = applyShrineResult(wrong.progress, shrine.id, correctChoice(shrine).id);

  assert.deepEqual(initial.choiceLog, []);
  assert.equal(wrong.progress.choiceLog.length, 1);
  assert.equal(right.progress.choiceLog.length, 2);
  assert.equal(right.progress.choiceLog[0].correct, false);
  assert.equal(right.progress.choiceLog[1].correct, true);
  assert.equal(right.progress.choiceLog[1].topicId, shrine.topicId);
});

test('learning report distinguishes first-try success from retry success', () => {
  const firstTryShrine = SHRINES[0];
  const retryShrine = SHRINES[1];

  let progress = createInitialProgress();
  progress = applyShrineResult(progress, firstTryShrine.id, correctChoice(firstTryShrine).id).progress;
  progress = applyShrineResult(progress, retryShrine.id, incorrectChoice(retryShrine).id).progress;
  progress = applyShrineResult(progress, retryShrine.id, correctChoice(retryShrine).id).progress;

  const report = getLearningReport(progress);
  const byId = Object.fromEntries(report.topics.map((topic) => [topic.topicId, topic]));

  assert.equal(byId[firstTryShrine.topicId].status, 'first-try');
  assert.equal(byId[retryShrine.topicId].status, 'retry');
  assert.equal(byId[retryShrine.topicId].attempts, 2);
  assert.equal(report.solvedCount, 2);
  assert.equal(report.firstTryCount, 1);
  assert.equal(report.reviewTopics.length, 1);
  assert.equal(report.reviewTopics[0].topicId, retryShrine.topicId);
});

test('learning report flags unsolved topics with wrong attempts for review', () => {
  const shrine = SHRINES[2];
  const progress = applyShrineResult(createInitialProgress(), shrine.id, incorrectChoice(shrine).id).progress;

  const report = getLearningReport(progress);
  const topic = report.topics.find((item) => item.topicId === shrine.topicId);

  assert.equal(topic.status, 'struggling');
  assert.equal(topic.solved, false);
  assert.ok(topic.reviewQuestionKo);
});

test('final core attempts land in the choice log and report', () => {
  const readyProgress = {
    ...createInitialProgress(),
    collectedFragments: ['privacy', 'bias', 'copyright']
  };

  const outcome = completeFinalCore(readyProgress, 'balanced-promise');
  const report = getLearningReport(outcome.progress);

  assert.equal(outcome.progress.choiceLog.length, 1);
  assert.equal(outcome.progress.choiceLog[0].kind, 'core');
  assert.equal(report.core.attempts, 1);
  assert.equal(report.core.completed, true);
});

test('normalizeProgress restores legacy saves and rejects malformed data', () => {
  const legacy = normalizeProgress({
    visitedTopics: ['privacy', 'not-a-topic'],
    completedShrines: ['privacy-shrine', 'fake-shrine'],
    collectedFragments: ['privacy'],
    aiCoreCompleted: 'yes'
  });

  assert.deepEqual(legacy.visitedTopics, ['privacy']);
  assert.deepEqual(legacy.completedShrines, ['privacy-shrine']);
  assert.deepEqual(legacy.choiceLog, []);
  assert.equal(legacy.aiCoreCompleted, false);

  assert.deepEqual(normalizeProgress(null), createInitialProgress());
  assert.deepEqual(normalizeProgress('garbage'), createInitialProgress());

  const withLog = normalizeProgress({
    choiceLog: [
      { kind: 'shrine', shrineId: 'privacy-shrine', topicId: 'privacy', choiceId: 'ask-and-limit', correct: true },
      { broken: true },
      'nope'
    ]
  });
  assert.equal(withLog.choiceLog.length, 1);
});
