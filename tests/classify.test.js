import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIFY_CHALLENGES,
  getClassifyChallenge,
  scoreClassify
} from '../src/classify.js';
import { ETHICS_TOPICS } from '../src/worldData.js';

test('every ethics topic has a classify challenge with balanced, well-formed cards', () => {
  for (const topic of ETHICS_TOPICS) {
    const challenge = getClassifyChallenge(topic.id);
    assert.ok(challenge, `${topic.id} needs a classify challenge`);
    assert.ok(challenge.cards.length >= 4, `${topic.id} needs at least 4 cards`);
    const answers = new Set(challenge.cards.map((card) => card.answer));
    // 두 바구니가 모두 쓰여야 분류가 의미 있다.
    assert.ok(answers.has('safe') && answers.has('caution'), `${topic.id} must use both buckets`);
    for (const card of challenge.cards) {
      assert.ok(card.textKo.length > 0);
      assert.ok(card.answer === 'safe' || card.answer === 'caution');
    }
  }
});

test('classify card ids are unique within a challenge', () => {
  for (const topicId of Object.keys(CLASSIFY_CHALLENGES)) {
    const ids = CLASSIFY_CHALLENGES[topicId].cards.map((card) => card.id);
    assert.equal(new Set(ids).size, ids.length, `${topicId} has duplicate card ids`);
  }
});

test('scoreClassify awards a full pass only when every card is placed correctly', () => {
  const challenge = getClassifyChallenge('privacy');
  const perfect = Object.fromEntries(challenge.cards.map((card) => [card.id, card.answer]));
  const result = scoreClassify('privacy', perfect);
  assert.equal(result.correct, challenge.cards.length);
  assert.equal(result.total, challenge.cards.length);
  assert.equal(result.passed, true);
});

test('scoreClassify counts partial and missing assignments as not passed', () => {
  const challenge = getClassifyChallenge('bias');
  const [first, ...rest] = challenge.cards;
  const partial = Object.fromEntries(rest.map((card) => [card.id, card.answer]));
  // 첫 카드는 일부러 반대로 배정.
  partial[first.id] = first.answer === 'safe' ? 'caution' : 'safe';

  const result = scoreClassify('bias', partial);
  assert.equal(result.passed, false);
  assert.equal(result.correct, challenge.cards.length - 1);
  const firstEntry = result.perCard.find((entry) => entry.cardId === first.id);
  assert.equal(firstEntry.correct, false);
});

test('scoreClassify tolerates empty assignments and unknown topics fail loudly', () => {
  const result = scoreClassify('copyright', undefined);
  assert.equal(result.correct, 0);
  assert.equal(result.passed, false);
  assert.throws(() => scoreClassify('not-a-topic', {}), /Unknown classify topic/);
});
