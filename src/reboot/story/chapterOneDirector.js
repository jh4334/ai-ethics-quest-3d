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

  // 이중 안전장치(S6a P0) — phase별로 다음에 보충해야 할 트리거. 어떤 경로로 보스에
  // 도달했든 completeBoss가 놓친 단계를 순서대로 fast-forward해 소프트락을 막는다.
  const catchUpEvents = Object.freeze({
    'cold-open': { triggerId: 'cold-open', type: 'trigger' },
    corridor: { triggerId: 'corridor-cleared', type: 'trigger' },
    'first-arena': { triggerId: 'first-arena-cleared', type: 'trigger' },
    'memory-decision': { action: 'purge', type: 'memory-action' },
    'memory-traced': { triggerId: 'backup-pressure-cleared', type: 'trigger' },
    'memory-secure-ready': { action: 'secure', type: 'memory-action' },
    pursuit: { triggerId: 'scanner-pursuit-cleared', type: 'trigger' }
  });

  return Object.freeze({
    completeBoss() {
      if (story.phase === 'complete') return false;
      // 재부팅 복원 — 이미 결말 체크포인트면 상태 변경 없이 성공 처리(멱등).
      if (story.phase === 'chapter-ending') return true;
      const fastForward = story.phase !== 'boss' && story.phase !== 'post-boss';
      let guard = 0;
      while (catchUpEvents[story.phase] && guard < 8) {
        transition(catchUpEvents[story.phase]);
        guard += 1;
      }
      // 보충된 중간 무전은 버린다 — 결말 대본(감독관 정지·승인 기록)만 흘러나온다.
      if (fastForward) {
        radio.length = 0;
        radioElapsedMs = 0;
      }
      if (story.phase === 'boss') transition({ triggerId: 'boss-defeated', type: 'trigger' });
      if (story.phase === 'post-boss') transition({ triggerId: 'approval-record-opened', type: 'trigger' });
      return story.phase === 'chapter-ending';
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
