import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINALE,
  buildNovaCertificate,
  getFinaleToolSteps,
  getTeachingLines
} from '../src/finale.js';
import { createInitialProgress } from '../src/worldData.js';
import { applyGateChoice, applyIntroTalk, createStoryState, QUESTS } from '../src/story.js';

function fresh() {
  return { ...createInitialProgress(), story: createStoryState() };
}

// 한 주제를 실제로 (도구 획득 → NPC 대화 → 관문 해결) 통과시킨 진행 상태를 만든다.
function solveTopic(progress, topicId, toolId, { withMistake = false } = {}) {
  let next = applyIntroTalk(progress, topicId);
  next = { ...next, tools: [...new Set([...(next.tools ?? []), toolId])] };
  if (withMistake) {
    const unwise = QUESTS[topicId].gate.options.find((o) => !o.wise);
    next = applyGateChoice(next, topicId, unwise.id).progress;
  }
  const wise = QUESTS[topicId].gate.options.find((o) => o.wise);
  const outcome = applyGateChoice(next, topicId, wise.id);
  return { ...outcome.progress, collectedFragments: [...new Set([...(next.collectedFragments ?? []), topicId])] };
}

test('finale offers exactly one wise (teach) and one unwise (erase) choice with an erase recovery', () => {
  const teach = FINALE.choices.filter((c) => c.wise);
  const erase = FINALE.choices.filter((c) => !c.wise);
  assert.equal(teach.length, 1);
  assert.equal(erase.length, 1);
  assert.equal(erase[0].id, 'erase');
  assert.equal(teach[0].id, 'teach');
  assert.ok(FINALE.eraseKo.length >= 1, 'erase branch gently refuses and re-asks');
  assert.ok(FINALE.rebirthKo.length >= 1 && FINALE.introKo.length >= 1);
});

test('tool steps follow story order and only include owned promise tools', () => {
  const progress = { ...fresh(), tools: ['bell', 'shield'] };
  const steps = getFinaleToolSteps(progress);
  assert.deepEqual(steps.map((s) => s.toolId), ['shield', 'bell']);
  assert.ok(steps.every((s) => s.actionKo && s.resultKo && s.emoji));
});

test('tool steps never leave the boss sequence empty when the player has no tools', () => {
  const steps = getFinaleToolSteps({ ...fresh(), tools: [] });
  assert.equal(steps.length, 1);
  assert.ok(steps[0].actionKo);
});

test('teaching lines replay the actual deed the player performed, in order', () => {
  let progress = fresh();
  progress = solveTopic(progress, 'privacy', 'shield');
  progress = solveTopic(progress, 'bias', 'mirror');

  const lines = getTeachingLines(progress);
  assert.deepEqual(lines.map((l) => l.topicId), ['privacy', 'bias']);
  const wisePrivacy = QUESTS.privacy.gate.options.find((o) => o.wise).deedKo;
  assert.equal(lines[0].deedKo, wisePrivacy);
  assert.ok(lines.every((l) => l.promiseKo));
  assert.equal(lines[0].recovered, false);
});

test('a recovered mistake is remembered and surfaced with pride on the certificate', () => {
  let progress = fresh();
  progress = solveTopic(progress, 'copyright', 'bell', { withMistake: true });

  const lines = getTeachingLines(progress);
  assert.equal(lines[0].recovered, true);
  // 실수 후 바로잡은 행적이 그대로 남는다.
  const recoveredDeed = QUESTS.copyright.gate.options.find((o) => !o.wise).deedKo;
  assert.equal(lines[0].deedKo, recoveredDeed);

  const cert = buildNovaCertificate(progress);
  assert.equal(cert.recovered, true);
  assert.match(cert.recoveredNoteKo, /바로잡/);
  assert.equal(cert.titleKo, '노바의 첫 친구 증명서');
});

test('certificate falls back to collected fragments when story deeds are missing', () => {
  const progress = { ...fresh(), collectedFragments: ['privacy', 'bias'] };
  const cert = buildNovaCertificate(progress);
  assert.deepEqual(cert.deeds.map((d) => d.topicId), ['privacy', 'bias']);
  assert.equal(cert.recovered, false);
  assert.equal(cert.recoveredNoteKo, '');
});
