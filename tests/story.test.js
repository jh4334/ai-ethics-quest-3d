import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROLOGUE,
  QUESTS,
  STORY_TOPIC_ORDER,
  applyGateChoice,
  applyIntroTalk,
  createStoryState,
  getGateDialog,
  getGateStatus,
  getNpcDialog,
  getStoryObjective,
  getStoryVisualFlags,
  normalizeStoryState
} from '../src/story.js';
import { createInitialProgress, normalizeProgress } from '../src/worldData.js';

function fresh() {
  return { ...createInitialProgress(), story: createStoryState() };
}

test('every quest is well-formed: one wise and one unwise gate option, matching tool', () => {
  const toolByTopic = { privacy: 'shield', bias: 'mirror', copyright: 'bell', deepfake: 'compass' };
  for (const topicId of STORY_TOPIC_ORDER) {
    const quest = QUESTS[topicId];
    assert.equal(quest.toolId, toolByTopic[topicId]);
    assert.ok(quest.introKo.length >= 1 && quest.resolveKo.length >= 1);
    const wise = quest.gate.options.filter((o) => o.wise);
    const unwise = quest.gate.options.filter((o) => !o.wise);
    assert.equal(wise.length, 1, `${topicId} needs exactly one wise option`);
    assert.ok(unwise.length >= 1, `${topicId} needs a recovery (unwise) option`);
    assert.ok(unwise.every((o) => o.recoveryKo), `${topicId} unwise options need recovery text`);
  }
});

test('gate is locked until you talk to the NPC and hold the tool', () => {
  let progress = fresh();
  assert.equal(getGateStatus(progress, 'privacy'), 'need-intro');
  assert.equal(getNpcDialog(progress, 'privacy').kind, 'intro');

  progress = applyIntroTalk(progress, 'privacy');
  assert.equal(getGateStatus(progress, 'privacy'), 'need-tool');
  assert.equal(getNpcDialog(progress, 'privacy').kind, 'seek-tool');
  assert.equal(getGateDialog(progress, 'privacy').kind, 'need-tool');

  progress = { ...progress, tools: ['shield'] };
  assert.equal(getGateStatus(progress, 'privacy'), 'ready');
  assert.equal(getGateDialog(progress, 'privacy').kind, 'choice');
});

test('wise gate choice solves the zone and signals a fragment award', () => {
  let progress = applyIntroTalk(fresh(), 'privacy');
  progress = { ...progress, tools: ['shield'] };
  const wise = QUESTS.privacy.gate.options.find((o) => o.wise);

  const outcome = applyGateChoice(progress, 'privacy', wise.id);
  assert.equal(outcome.wise, true);
  assert.equal(outcome.solved, true);
  assert.equal(outcome.awardFragment, true);
  assert.equal(outcome.progress.story.privacy.solved, true);
  assert.ok(outcome.progress.story.privacy.deeds.length >= 1);
  assert.equal(getGateStatus(outcome.progress, 'privacy'), 'solved');
  assert.ok(getStoryVisualFlags(outcome.progress).has('privacy:solved'));
});

test('unwise choice is recoverable: it scars the world, awards no fragment, and lets you retry', () => {
  let progress = applyIntroTalk(fresh(), 'bias');
  progress = { ...progress, tools: ['mirror'] };
  const unwise = QUESTS.bias.gate.options.find((o) => !o.wise);
  const wise = QUESTS.bias.gate.options.find((o) => o.wise);

  const bad = applyGateChoice(progress, 'bias', unwise.id);
  assert.equal(bad.wise, false);
  assert.equal(bad.awardFragment, false);
  assert.equal(bad.solved, false);
  assert.ok(bad.recoveryKo);
  assert.equal(bad.progress.story.bias.badTries, 1);
  assert.ok(getStoryVisualFlags(bad.progress).has('bias:scarred'));

  // 다시 도전해서 현명하게 해결하면 조각 획득.
  const good = applyGateChoice(bad.progress, 'bias', wise.id);
  assert.equal(good.awardFragment, true);
  assert.equal(good.progress.story.bias.solved, true);
  // 두 행적(실수+바로잡음, 그리고 현명한 해결)이 모두 기억된다.
  assert.ok(good.progress.story.bias.deeds.length >= 2);
});

test('a solved gate ignores further choices and the npc gives its closing line', () => {
  let progress = applyIntroTalk(fresh(), 'copyright');
  progress = { ...progress, tools: ['bell'] };
  const wise = QUESTS.copyright.gate.options.find((o) => o.wise);
  progress = applyGateChoice(progress, 'copyright', wise.id).progress;

  const again = applyGateChoice(progress, 'copyright', wise.id);
  assert.equal(again.awardFragment, false);
  assert.equal(getNpcDialog(progress, 'copyright').kind, 'closing');
});

test('objective walks the zones in order through talk, tool, and gate stages', () => {
  let progress = fresh();
  assert.match(getStoryObjective(progress), /흩어진 사진들.*이야기/);
  progress = applyIntroTalk(progress, 'privacy');
  assert.match(getStoryObjective(progress), /사당에서 도구/);
  progress = { ...progress, tools: ['shield'] };
  assert.match(getStoryObjective(progress), /도구를 사용/);
});

test('prologue is well-formed and progress tracks whether it has been seen', () => {
  assert.ok(PROLOGUE.beats.length >= 2, 'prologue needs at least a couple of beats');
  assert.ok(PROLOGUE.beats.every((b) => Array.isArray(b.linesKo) && b.linesKo.length >= 1));
  assert.ok(PROLOGUE.closingKo);
  // 첫 진행 상태는 프롤로그 미시청, 정규화는 불리언만 허용.
  assert.equal(createInitialProgress().prologueSeen, false);
  assert.equal(normalizeProgress({ prologueSeen: 'yes' }).prologueSeen, false);
  assert.equal(normalizeProgress({ prologueSeen: true }).prologueSeen, true);
});

test('normalizeStoryState repairs garbage and rejects bad fields', () => {
  assert.deepEqual(normalizeStoryState(null), createStoryState());
  const repaired = normalizeStoryState({ privacy: { solved: 'yes', badTries: -3, deeds: 'x' } });
  assert.equal(repaired.privacy.solved, false);
  assert.equal(repaired.privacy.badTries, 0);
  assert.deepEqual(repaired.privacy.deeds, []);
});

test('josaWaGwa(루프A): 받침 유무로 와/과를 고른다 — 목표 문구 조사 오류 방지', async () => {
  const { josaWaGwa, getStoryObjective } = await import('../src/story.js');
  assert.equal(josaWaGwa('담'), '과');
  assert.equal(josaWaGwa('모리'), '와');
  assert.equal(josaWaGwa('무로'), '와');
  assert.equal(josaWaGwa('에코'), '와');
  assert.equal(josaWaGwa('Nova'), '와'); // 비한글은 안전 기본값
  // 실제 목표 문구에서 '담와' 같은 오류가 나오지 않는다.
  const { createInitialProgress } = await import('../src/worldData.js');
  const objective = getStoryObjective(createInitialProgress());
  assert.doesNotMatch(objective, /담와/);
});
