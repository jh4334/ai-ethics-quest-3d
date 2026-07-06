import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHRINES,
  createInitialProgress,
  evaluateExtraQuestion,
  getExtraShrineQuestions,
  getLearningReport,
  recordPracticeChoice
} from '../src/worldData.js';

test('every shrine ships a practice bank with well-formed questions', () => {
  for (const shrine of SHRINES) {
    const extras = getExtraShrineQuestions(shrine.id);
    assert.ok(extras.length >= 2, `${shrine.id} should have at least two practice questions`);
    for (const question of extras) {
      assert.ok(question.id.length > 0);
      assert.ok(question.questionKo.length >= 10);
      const correct = question.choices.filter((choice) => choice.correct);
      assert.equal(correct.length, 1, `${question.id} needs exactly one correct choice`);
      assert.ok(question.feedback.correct.length >= 10);
      assert.ok(question.feedback.incorrect.length >= 10);
    }
  }
});

test('practice question ids are unique within each shrine', () => {
  for (const shrine of SHRINES) {
    const ids = getExtraShrineQuestions(shrine.id).map((question) => question.id);
    assert.equal(new Set(ids).size, ids.length, `${shrine.id} has duplicate practice ids`);
  }
});

test('evaluateExtraQuestion returns feedback and fails loudly on bad input', () => {
  const shrine = SHRINES[0];
  const question = getExtraShrineQuestions(shrine.id)[0];
  const correctChoice = question.choices.find((choice) => choice.correct);
  const wrongChoice = question.choices.find((choice) => !choice.correct);

  const good = evaluateExtraQuestion(shrine.id, question.id, correctChoice.id);
  assert.equal(good.correct, true);
  assert.equal(good.feedbackKo, question.feedback.correct);

  const bad = evaluateExtraQuestion(shrine.id, question.id, wrongChoice.id);
  assert.equal(bad.correct, false);
  assert.equal(bad.feedbackKo, question.feedback.incorrect);

  assert.throws(() => evaluateExtraQuestion(shrine.id, 'nope', correctChoice.id), /Unknown practice question/);
  assert.throws(() => evaluateExtraQuestion(shrine.id, question.id, 'nope'), /Unknown choice/);
});

test('recordPracticeChoice logs practice attempts without touching fragments or shrine status', () => {
  const shrine = SHRINES[1];
  const question = getExtraShrineQuestions(shrine.id)[0];
  const correctChoice = question.choices.find((choice) => choice.correct);

  const initial = createInitialProgress();
  const outcome = recordPracticeChoice(initial, shrine.id, question.id, correctChoice.id);

  assert.deepEqual(initial.choiceLog, []);
  assert.equal(outcome.progress.choiceLog.length, 1);
  assert.equal(outcome.progress.choiceLog[0].kind, 'practice');
  assert.equal(outcome.progress.choiceLog[0].topicId, shrine.topicId);
  // 연습 문제는 조각/사당 완료 상태를 바꾸지 않는다.
  assert.deepEqual(outcome.progress.collectedFragments, []);
  assert.deepEqual(outcome.progress.completedShrines, []);
});

test('learning report counts practice attempts separately from shrine status', () => {
  const shrine = SHRINES[2];
  const [q1, q2] = getExtraShrineQuestions(shrine.id);
  const q1Correct = q1.choices.find((choice) => choice.correct);
  const q2Wrong = q2.choices.find((choice) => !choice.correct);

  let progress = createInitialProgress();
  progress = recordPracticeChoice(progress, shrine.id, q1.id, q1Correct.id).progress;
  progress = recordPracticeChoice(progress, shrine.id, q2.id, q2Wrong.id).progress;

  const report = getLearningReport(progress);
  assert.equal(report.practiceCount, 2);
  assert.equal(report.practiceCorrectCount, 1);
  // practice 만으로는 주제가 '해결'로 바뀌지 않는다.
  const topic = report.topics.find((item) => item.topicId === shrine.topicId);
  assert.equal(topic.solved, false);
});
