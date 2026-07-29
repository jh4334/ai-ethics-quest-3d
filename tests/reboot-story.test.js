import assert from 'node:assert/strict';
import test from 'node:test';

import { chapterOneStory } from '../src/reboot/content/story/chapter1.js';
import { serializeSave, parseStoredSave } from '../src/reboot/save/codec.js';
import {
  createChapterOneStory,
  transitionChapterOne
} from '../src/reboot/story/chapterOneMachine.js';
import { createChapterOneOutcome } from '../src/reboot/story/chapterOneOutcome.js';
import { validateStoryContent } from '../src/reboot/story/validateStory.js';

function advanceToMemoryDecision() {
  let story = createChapterOneStory();
  for (const triggerId of ['cold-open', 'corridor-cleared', 'first-arena-cleared']) {
    story = transitionChapterOne(story, { type: 'trigger', triggerId });
  }
  return story;
}

function finishFromPursuit(story) {
  let current = transitionChapterOne(story, { type: 'trigger', triggerId: 'scanner-pursuit-cleared' });
  current = transitionChapterOne(current, { type: 'trigger', triggerId: 'boss-defeated' });
  return transitionChapterOne(current, { type: 'trigger', triggerId: 'approval-record-opened' });
}

test('story content validates deterministic triggers, evidence, and radio budgets', () => {
  // Given: the authored Attendance Zero story graph.
  // When: it crosses the story-content boundary.
  const validated = validateStoryContent(chapterOneStory);

  // Then: all authored beats remain immutable and within moving-dialogue budgets.
  assert.equal(validated, chapterOneStory);
  assert.equal(validated.beats.length, 11);
  assert.equal(Object.isFrozen(validated.beats), true);
  assert.equal(validated.beats.every((beat) => beat.radio.every((line) => line.interruptible)), true);
});

test('chapter one establishes agency and responsibility before the protected signature reveal', () => {
  // Given: every playable radio line before the approval record opens.
  const earlyLines = chapterOneStory.beats
    .filter((beat) => beat.triggerId !== 'approval-record-opened' && beat.order < 8)
    .flatMap((beat) => beat.radio);
  const earlyText = earlyLines.map((line) => `${line.speaker}: ${line.textKo}`).join('\n');

  // When / Then: each role has one terse, non-spoiler responsibility cue.
  assert.match(earlyText, /하루[^\n]*(숨겼|남겼|공개)/);
  assert.match(earlyText, /DOT[^\n]*(감사 AI|동기화.*맡)/);
  assert.match(earlyText, /윤서[^\n]*(보류|메모|정책)/);
  assert.match(earlyText, /(네 선택|선택[^\n]*기록)/);
  assert.doesNotMatch(earlyText, /PLAYER-ID|플레이어의 학생 ID/);
});

test('story validation rejects duplicate, missing, impossible, spoiler, and oversized content', () => {
  // Given: one valid graph and independent malformed variants.
  const duplicate = { ...chapterOneStory, beats: [...chapterOneStory.beats, chapterOneStory.beats[0]] };
  const missingEvidence = {
    ...chapterOneStory,
    beats: chapterOneStory.beats.map((beat) => (
      beat.triggerId === 'memory-secured' ? { ...beat, evidenceId: 'missing-record' } : beat
    ))
  };
  const impossible = {
    ...chapterOneStory,
    beats: chapterOneStory.beats.map((beat) => (
      beat.triggerId === 'boss-defeated'
        ? { ...beat, requiresAll: ['memory-secured', 'memory-purged'], requiresAny: [] }
        : beat
    ))
  };
  const spoiler = {
    ...chapterOneStory,
    beats: chapterOneStory.beats.map((beat) => (
      beat.triggerId === 'approval-record-opened' ? { ...beat, requiresAll: [] } : beat
    ))
  };
  const oversized = {
    ...chapterOneStory,
    beats: chapterOneStory.beats.map((beat) => (
      beat.triggerId === 'cold-open'
        ? { ...beat, radio: [{ ...beat.radio[0], textKo: '가'.repeat(75) }] }
        : beat
    ))
  };
  const overlongDuration = {
    ...chapterOneStory,
    beats: chapterOneStory.beats.map((beat) => (
      beat.triggerId === 'cold-open'
        ? { ...beat, radio: [{ ...beat.radio[0], durationMs: 6201 }] }
        : beat
    ))
  };

  // When / Then: each invalid graph fails for its own contract.
  assert.throws(() => validateStoryContent(duplicate), /중복/);
  assert.throws(() => validateStoryContent(missingEvidence), /증거/);
  assert.throws(() => validateStoryContent(impossible), /동시에/);
  assert.throws(() => validateStoryContent(spoiler), /공개 순서/);
  assert.throws(() => validateStoryContent(oversized), /길이/);
  assert.throws(() => validateStoryContent(overlongDuration), /시간/);
});

test('secure path requires TRACE pressure and persists a costly truth', () => {
  // Given: the backup terminal has been reached.
  let story = advanceToMemoryDecision();

  // When: TRACE draws a wave, pressure clears, and SECURE fixes the record.
  story = transitionChapterOne(story, { type: 'memory-action', action: 'trace' });
  assert.throws(
    () => transitionChapterOne(story, { type: 'memory-action', action: 'secure' }),
    /압력 신호/
  );
  story = transitionChapterOne(story, { type: 'trigger', triggerId: 'backup-pressure-cleared' });
  story = transitionChapterOne(story, { type: 'memory-action', action: 'secure' });

  // Then: integrity, trust, encounter cost, and a reloadable checkpoint all retain the action.
  assert.deepEqual(story.campaign.integrity, { secured: 1, lost: 0 });
  assert.deepEqual(story.campaign.exposure, { contained: 1, disclosed: 0 });
  assert.equal(story.campaign.trust.haru, 12);
  assert.equal(story.campaign.trust.dot, -8);
  assert.deepEqual(story.effects, {
    arenaDressing: 'amber-backup',
    backupVisible: true,
    bossCallout: '원본 한 개가 아직 체육관에 남아 있다.',
    extraWave: true
  });
  const restored = createChapterOneStory(parseStoredSave(serializeSave(story.campaign)).state);
  assert.equal(restored.phase, 'pursuit');
  assert.deepEqual(restored.effects, story.effects);
});

test('purge path reaches the boss quickly and keeps the missing context visible', () => {
  // Given: the same memory decision without tracing it.
  let story = advanceToMemoryDecision();

  // When: PURGE is used immediately and the chapter reaches its post-boss record.
  story = transitionChapterOne(story, { type: 'memory-action', action: 'purge' });
  story = finishFromPursuit(story);
  const outcome = createChapterOneOutcome(story);

  // Then: the route remains viable while its different cost is explicit and non-judgmental.
  assert.deepEqual(story.campaign.integrity, { secured: 1, lost: 1 });
  assert.equal(story.campaign.trust.haru, -8);
  assert.equal(story.campaign.trust.dot, 6);
  assert.equal(story.effects.backupVisible, false);
  assert.equal(story.effects.extraWave, false);
  assert.equal(story.phase, 'chapter-ending');
  assert.match(outcome.routeConsequenceKo, /백업 내용과 출처 연결은 사라졌다/);
  assert.doesNotMatch(JSON.stringify(outcome), /correct|wrong|정답|오답|현명|실패/i);
});

test('automated transcripts reveal the player signature only after the boss', () => {
  // Given: a secure route captured as moving radio transcript.
  let story = advanceToMemoryDecision();
  story = transitionChapterOne(story, { type: 'memory-action', action: 'trace' });
  story = transitionChapterOne(story, { type: 'trigger', triggerId: 'backup-pressure-cleared' });
  story = transitionChapterOne(story, { type: 'memory-action', action: 'secure' });
  story = transitionChapterOne(story, { type: 'trigger', triggerId: 'scanner-pursuit-cleared' });
  const beforeBoss = JSON.stringify(story.transcript);
  story = transitionChapterOne(story, { type: 'trigger', triggerId: 'boss-defeated' });
  const afterBossBeforeRecord = JSON.stringify(story.transcript);
  story = transitionChapterOne(story, { type: 'trigger', triggerId: 'approval-record-opened' });
  const signatureLine = story.transcript.find((line) => line.textKo.includes('PLAYER-ID'));

  // Then: no early line leaks the twist; the signed record follows boss defeat.
  assert.doesNotMatch(beforeBoss, /PLAYER-ID|플레이어의 학생 ID/);
  assert.doesNotMatch(afterBossBeforeRecord, /PLAYER-ID|플레이어의 학생 ID/);
  assert.equal(signatureLine.triggerId, 'approval-record-opened');
  assert.equal(story.campaign.evidence.at(-1).evidenceId, 'player-approval-record');
});

test('out-of-order triggers and invalid memory verbs cannot skip story state', () => {
  // Given: the chapter has not left its cold open.
  const story = createChapterOneStory();

  // When / Then: future beats and unsupported actions are rejected without mutation.
  assert.throws(
    () => transitionChapterOne(story, { type: 'trigger', triggerId: 'boss-defeated' }),
    /현재 단계/
  );
  assert.throws(
    () => transitionChapterOne(story, { type: 'memory-action', action: 'share' }),
    /기억 백업 행동/
  );
  assert.equal(story.phase, 'cold-open');
  assert.deepEqual(story.campaign.evidence, []);
});
