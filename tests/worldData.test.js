import test from 'node:test';
import assert from 'node:assert/strict';
import { ETHICS_TOPICS, WORLD_ZONES, SHRINES, getProgressSummary, canUnlockFinalCore } from '../src/worldData.js';

test('world includes the four required AI ethics topics for elementary students', () => {
  assert.deepEqual(ETHICS_TOPICS.map((topic) => topic.id), ['privacy', 'bias', 'copyright', 'deepfake']);
  for (const topic of ETHICS_TOPICS) {
    assert.ok(topic.titleKo.length > 0);
    assert.ok(topic.studentTakeaway.length >= 12);
  }
});

test('open world has four zones with non-infringing Zelda-like exploration roles', () => {
  assert.equal(WORLD_ZONES.length, 4);
  assert.equal(new Set(WORLD_ZONES.map((zone) => zone.topicId)).size, 4);
  for (const zone of WORLD_ZONES) {
    assert.ok(Array.isArray(zone.position));
    assert.equal(zone.position.length, 3);
    assert.ok(zone.npc.prompt.includes('AI'));
    assert.ok(!/zelda|link|hyrule/i.test(`${zone.nameKo} ${zone.descriptionKo}`));
  }
});

test('shrines have correct answer choices and age-appropriate feedback', () => {
  assert.ok(SHRINES.length >= 3);
  for (const shrine of SHRINES) {
    const correctChoices = shrine.choices.filter((choice) => choice.correct);
    assert.equal(correctChoices.length, 1, shrine.id);
    assert.ok(shrine.feedback.correct.length >= 10);
    assert.ok(shrine.feedback.incorrect.length >= 10);
  }
});

test('progress summary unlocks final AI core only after at least three fragments', () => {
  assert.equal(canUnlockFinalCore(['privacy', 'bias']), false);
  assert.equal(canUnlockFinalCore(['privacy', 'bias', 'copyright']), true);
  const summary = getProgressSummary(['privacy', 'bias', 'copyright']);
  assert.equal(summary.collected, 3);
  assert.equal(summary.total, 4);
  assert.equal(summary.finalCoreUnlocked, true);
});
