import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORY_QUESTS,
  STORY_TOPIC_ORDER,
  applyStoryEvent,
  createStoryState,
  getActivePickups,
  getActivePoints,
  getNpcStory,
  getStoryDeeds,
  getStoryObjective,
  getStoryVisualFlags,
  normalizeStoryState
} from '../src/story.js';
import { createInitialProgress } from '../src/worldData.js';

function freshProgress() {
  return { ...createInitialProgress(), story: createStoryState() };
}

// 이벤트 목록을 순서대로 적용하고 조각 획득 횟수를 센다.
function playEvents(progress, topicId, events) {
  let fragments = 0;
  for (const event of events) {
    const outcome = applyStoryEvent(progress, topicId, event);
    progress = outcome.progress;
    if (outcome.effects.fragmentTopicId === topicId) {
      fragments += 1;
    }
  }
  return { progress, fragments };
}

test('story data is well-formed: every step link resolves and each quest has one fragment step', () => {
  for (const topicId of STORY_TOPIC_ORDER) {
    const quest = STORY_QUESTS[topicId];
    assert.ok(quest.steps[quest.start], `${topicId} start step missing`);
    let fragmentSteps = 0;
    for (const [stepId, step] of Object.entries(quest.steps)) {
      if (step.fragment) {
        fragmentSteps += 1;
      }
      const nexts = [];
      if ('next' in step && step.next !== null) {
        nexts.push(step.next);
      }
      if (step.options) {
        nexts.push(...step.options.map((o) => o.next));
      }
      if (step.points) {
        nexts.push(...step.points.map((p) => p.next));
      }
      if (step.branches) {
        nexts.push(...Object.values(step.branches));
      }
      for (const next of nexts) {
        assert.ok(quest.steps[next], `${topicId}.${stepId} links to missing step "${next}"`);
      }
    }
    assert.equal(fragmentSteps, 1, `${topicId} must have exactly one fragment step`);
  }
});

test('privacy quest: asking first completes with one fragment and a kind deed', () => {
  const { progress, fragments } = playEvents(freshProgress(), 'privacy', [
    { type: 'talk' },
    { type: 'pickup', id: 'photo-1' },
    { type: 'pickup', id: 'photo-2' },
    { type: 'pickup', id: 'photo-3' },
    { type: 'choice', optionId: 'ask' },
    { type: 'talk' }
  ]);
  assert.equal(progress.story.privacy.done, true);
  assert.equal(fragments, 1);
  assert.ok(progress.story.privacy.deeds.includes('사진 주인에게 먼저 물어봤다'));
  assert.equal(getStoryVisualFlags(progress).has('privacy:posted'), false);
});

test('privacy quest: posting is not a fail state — the repair branch converges and still earns the fragment', () => {
  const { progress, fragments } = playEvents(freshProgress(), 'privacy', [
    { type: 'talk' },
    { type: 'pickup', id: 'photo-1' },
    { type: 'pickup', id: 'photo-2' },
    { type: 'pickup', id: 'photo-3' },
    { type: 'choice', optionId: 'post' },
    { type: 'talk' }, // regret(회수·사과)
    { type: 'talk' } // resolve
  ]);
  assert.equal(progress.story.privacy.done, true);
  assert.equal(fragments, 1);
  assert.ok(progress.story.privacy.deeds.includes('사진을 묻지 않고 게시판에 붙였다'));
  assert.ok(progress.story.privacy.deeds.includes('사진을 다시 떼어 주인들에게 사과했다'));
  assert.ok(getStoryVisualFlags(progress).has('privacy:posted'));
  assert.ok(getStoryVisualFlags(progress).has('privacy:done'));
});

test('bias quest: what you gather IS the choice — same seeds branch to monotone, then recovery', () => {
  let run = playEvents(freshProgress(), 'bias', [
    { type: 'talk' },
    { type: 'pickup', id: 'seed-red-1' },
    { type: 'pickup', id: 'seed-red-2' },
    { type: 'pickup', id: 'seed-red-3' }
  ]);
  assert.equal(run.progress.story.bias.stepId, 'monotone');
  run = playEvents(run.progress, 'bias', [
    { type: 'talk' }, // monotone 설명
    { type: 'pickup', id: 'seed-yellow-1' },
    { type: 'talk' } // bloom
  ]);
  assert.equal(run.progress.story.bias.done, true);
  assert.equal(run.fragments, 1);
  assert.ok(getStoryVisualFlags(run.progress).has('bias:mono'));
});

test('bias quest: diverse seeds skip straight to bloom', () => {
  const { progress, fragments } = playEvents(freshProgress(), 'bias', [
    { type: 'talk' },
    { type: 'pickup', id: 'seed-red-1' },
    { type: 'pickup', id: 'seed-yellow-1' },
    { type: 'pickup', id: 'seed-purple-1' },
    { type: 'talk' }
  ]);
  assert.equal(progress.story.bias.done, true);
  assert.equal(fragments, 1);
  assert.equal(getStoryVisualFlags(progress).has('bias:mono'), false);
});

test('copyright quest: walking to the copier leaves a scar and requires an apology visit', () => {
  const { progress, fragments } = playEvents(freshProgress(), 'copyright', [
    { type: 'talk' },
    { type: 'visit', pointId: 'echo' },
    { type: 'talk' }, // copied 설명
    { type: 'visit', pointId: 'muro-sorry' },
    { type: 'talk' } // granted
  ]);
  assert.equal(progress.story.copyright.done, true);
  assert.equal(fragments, 1);
  assert.ok(getStoryVisualFlags(progress).has('copyright:copied'));
  assert.ok(progress.story.copyright.deeds.includes('무로에게 사과하고 조각상에 이름표를 달았다'));
});

test('deepfake quest: verifying first avoids the goblin chase entirely', () => {
  const direct = playEvents(freshProgress(), 'deepfake', [
    { type: 'talk' },
    { type: 'visit', pointId: 'elder' },
    { type: 'talk' }, // warned
    { type: 'talk' } // lesson
  ]);
  assert.equal(direct.progress.story.deepfake.done, true);
  assert.equal(direct.fragments, 1);

  const tricked = playEvents(freshProgress(), 'deepfake', [
    { type: 'talk' },
    { type: 'visit', pointId: 'cave-drop' },
    { type: 'talk' }, // tricked 설명
    { type: 'visit', pointId: 'goblin' },
    { type: 'talk' } // lesson
  ]);
  assert.equal(tricked.progress.story.deepfake.done, true);
  assert.equal(tricked.fragments, 1);
  assert.ok(getStoryVisualFlags(tricked.progress).has('deepfake:obeyed'));
});

test('active pickups shrink as photos are collected and points appear only on visit steps', () => {
  let progress = freshProgress();
  progress = applyStoryEvent(progress, 'privacy', { type: 'talk' }).progress;
  assert.equal(getActivePickups(progress.story).filter((p) => p.topicId === 'privacy').length, 3);
  progress = applyStoryEvent(progress, 'privacy', { type: 'pickup', id: 'photo-1' }).progress;
  assert.equal(getActivePickups(progress.story).filter((p) => p.topicId === 'privacy').length, 2);

  assert.equal(getActivePoints(progress.story).length, 0);
  progress = applyStoryEvent(progress, 'copyright', { type: 'talk' }).progress;
  const points = getActivePoints(progress.story).filter((p) => p.topicId === 'copyright');
  assert.equal(points.length, 2);
});

test('npc story surfaces talk lines, choice options, nudges, and closing lines by state', () => {
  let progress = freshProgress();
  assert.equal(getNpcStory(progress.story, 'privacy').kind, 'talk');
  progress = applyStoryEvent(progress, 'privacy', { type: 'talk' }).progress;
  assert.equal(getNpcStory(progress.story, 'privacy').kind, 'nudge');
  for (const id of ['photo-1', 'photo-2', 'photo-3']) {
    progress = applyStoryEvent(progress, 'privacy', { type: 'pickup', id }).progress;
  }
  const choice = getNpcStory(progress.story, 'privacy');
  assert.equal(choice.kind, 'choice');
  assert.equal(choice.options.length, 2);
  progress = applyStoryEvent(progress, 'privacy', { type: 'choice', optionId: 'ask' }).progress;
  progress = applyStoryEvent(progress, 'privacy', { type: 'talk' }).progress;
  assert.equal(getNpcStory(progress.story, 'privacy').kind, 'done');
});

test('story objective walks quests in order and reports collect progress', () => {
  let progress = freshProgress();
  assert.match(getStoryObjective(progress, {}), /흩어진 사진들/);
  progress = applyStoryEvent(progress, 'privacy', { type: 'talk' }).progress;
  progress = applyStoryEvent(progress, 'privacy', { type: 'pickup', id: 'photo-1' }).progress;
  assert.match(getStoryObjective(progress, {}), /\(1\/3\)/);
});

test('deeds accumulate into the island memory and normalization survives garbage', () => {
  let progress = freshProgress();
  progress = applyStoryEvent(progress, 'privacy', { type: 'talk' }).progress;
  for (const id of ['photo-1', 'photo-2', 'photo-3']) {
    progress = applyStoryEvent(progress, 'privacy', { type: 'pickup', id }).progress;
  }
  progress = applyStoryEvent(progress, 'privacy', { type: 'choice', optionId: 'post' }).progress;
  const deeds = getStoryDeeds(progress);
  assert.equal(deeds.length, 1);
  assert.equal(deeds[0].topicId, 'privacy');

  assert.deepEqual(normalizeStoryState(null), createStoryState());
  const repaired = normalizeStoryState({ privacy: { stepId: 'not-a-step', deeds: 'nope' } });
  assert.equal(repaired.privacy.stepId, 'meet');
  assert.deepEqual(repaired.privacy.deeds, []);
});
