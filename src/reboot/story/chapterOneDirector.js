import { createChapterOneStory, transitionChapterOne } from './chapterOneMachine.js';
import { createChapterOneOutcome } from './chapterOneOutcome.js';
import { createSliceTimeline } from '../slice/contract.js';

function branchStory(branch) {
  let state = createChapterOneStory();
  for (const triggerId of ['cold-open', 'corridor-cleared', 'first-arena-cleared']) {
    state = transitionChapterOne(state, { triggerId, type: 'trigger' });
  }
  if (branch === 'secure') {
    state = transitionChapterOne(state, { action: 'trace', type: 'memory-action' });
    state = transitionChapterOne(state, { triggerId: 'backup-pressure-cleared', type: 'trigger' });
    state = transitionChapterOne(state, { action: 'secure', type: 'memory-action' });
  } else {
    state = transitionChapterOne(state, { action: 'purge', type: 'memory-action' });
  }
  return transitionChapterOne(state, { triggerId: 'scanner-pursuit-cleared', type: 'trigger' });
}

function endingStory(branch) {
  let state = branchStory(branch);
  state = transitionChapterOne(state, { triggerId: 'boss-defeated', type: 'trigger' });
  return transitionChapterOne(state, { triggerId: 'approval-record-opened', type: 'trigger' });
}

export function createChapterOneBossFixture(branch) {
  if (!['purge', 'secure'].includes(branch)) throw new RangeError(`지원하지 않는 보스 경로: ${branch}`);
  const story = branchStory(branch);
  return Object.freeze({ branch, campaign: story.campaign });
}

export function createChapterOneEndingFixture(branch) {
  if (!['purge', 'secure'].includes(branch)) throw new RangeError(`지원하지 않는 결말 경로: ${branch}`);
  const story = endingStory(branch);
  return Object.freeze({
    branch,
    campaign: story.campaign,
    outcome: createChapterOneOutcome(story),
    sliceTimeline: createSliceTimeline(branch)
  });
}

export function createChapterOneDirector({ campaign, persist = () => {} } = {}) {
  let story = createChapterOneStory(campaign);
  let radio = [];
  let radioElapsedMs = 0;
  // 압력 게이트 기준점 — 프레임 수가 아니라 시뮬 고정 틱(60Hz)으로 잰다(기기 간 재현성).
  let pressureAnchorTick = null;

  function transition(event) {
    const transcriptLength = story.transcript.length;
    story = transitionChapterOne(story, event);
    radio.push(...story.transcript.slice(transcriptLength));
    persist(story.campaign);
    return story;
  }

  function start() {
    if (story.phase === 'cold-open') transition({ triggerId: 'cold-open', type: 'trigger' });
    return story;
  }

  function observe({ combatEvents = [], encounter, segmentId }) {
    if (story.phase === 'corridor' && segmentId === 'first-arena') {
      transition({ triggerId: 'corridor-cleared', type: 'trigger' });
    }
    const enemiesDefeated = encounter?.enemies?.length > 0
      && encounter.enemies.every((enemy) => enemy.phase === 'defeat');
    if (story.phase === 'first-arena' && enemiesDefeated) {
      transition({ triggerId: 'first-arena-cleared', type: 'trigger' });
    }
    if (story.phase === 'memory-decision' && combatEvents.some((event) => event.type === 'traced')) {
      transition({ action: 'trace', type: 'memory-action' });
    }
    if (story.phase === 'memory-traced') {
      const tick = encounter?.tick;
      if (Number.isFinite(tick)) {
        if (pressureAnchorTick === null) pressureAnchorTick = tick;
        if (tick - pressureAnchorTick >= 90) transition({ triggerId: 'backup-pressure-cleared', type: 'trigger' });
      }
    } else {
      pressureAnchorTick = null;
    }
    if (story.phase === 'memory-secure-ready' && combatEvents.some((event) => event.type === 'secured')) {
      transition({ action: 'secure', type: 'memory-action' });
    }
    if (story.phase === 'pursuit' && segmentId === 'gym-boss-arena') {
      transition({ triggerId: 'scanner-pursuit-cleared', type: 'trigger' });
    }
    return story;
  }

  return Object.freeze({
    completeBoss() {
      if (story.phase !== 'boss') return false;
      transition({ triggerId: 'boss-defeated', type: 'trigger' });
      transition({ triggerId: 'approval-record-opened', type: 'trigger' });
      return true;
    },
    getOutcome: () => createChapterOneOutcome(story),
    getRadioLine: () => radio[0] ?? null,
    getState: () => story,
    memoryAction(action) {
      if (action !== 'purge' || story.phase !== 'memory-decision') return false;
      transition({ action, type: 'memory-action' });
      return true;
    },
    observe,
    start,
    update(elapsedSeconds) {
      if (radio.length === 0) return null;
      radioElapsedMs += Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds * 1000 : 0);
      while (radio[0] && radioElapsedMs >= radio[0].durationMs) {
        radioElapsedMs -= radio[0].durationMs;
        radio.shift();
      }
      return radio[0] ?? null;
    }
  });
}
