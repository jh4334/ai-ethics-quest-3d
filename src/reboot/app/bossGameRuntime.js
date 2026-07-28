import { FIXED_HZ } from '../content/actions.js';
import { createBossState, resetBossState, stepBoss } from '../bosses/runtime.js';

const BOSS_ACTIONS = new Set(['attack', 'reflect', 'trace']);
const MAX_FRAME_SECONDS = 0.25;

function phaseOf(state) {
  return state.definition.phases[state.phaseIndex];
}

function bossAction(state, type, id) {
  const phase = phaseOf(state);
  const pattern = phase.patterns[state.cycleIndex % phase.patterns.length];
  if (type === 'trace') return { id, targetId: pattern.trueTargetId, type };
  if (type === 'attack') return { id, targetId: 'approval-core', type };
  return { id, type };
}

function splitActions(queue, state) {
  const phase = phaseOf(state);
  const ready = [];
  const deferred = [];
  for (const action of queue) {
    const matchesPhase = action.type === phase.response;
    const windowOpen = state.phaseTick >= phase.timing.windupTicks
      && state.phaseTick < phase.timing.windupTicks + phase.timing.activeTicks;
    if (matchesPhase && !windowOpen) deferred.push(action);
    else ready.push(action);
  }
  return { deferred, ready };
}

export function createBossGameRuntime({ consequencePath = 'secure', initialState = null } = {}) {
  let state = initialState ?? createBossState(undefined, { consequencePath });
  let accumulator = 0;
  let actionSequence = 0;
  let queue = [];

  return Object.freeze({
    getState: () => state,
    queueAction(type) {
      if (!BOSS_ACTIONS.has(type) || queue.length >= 8 || state.status !== 'active') return false;
      actionSequence += 1;
      queue.push(bossAction(state, type, `boss-action-${actionSequence}`));
      return true;
    },
    reset() {
      state = resetBossState(state);
      accumulator = 0;
      queue = [];
      return state;
    },
    update(elapsedSeconds, { playerHp = 100 } = {}) {
      const bounded = Number.isFinite(elapsedSeconds)
        ? Math.max(0, Math.min(MAX_FRAME_SECONDS, elapsedSeconds))
        : 0;
      accumulator += bounded * FIXED_HZ;
      const events = [];
      while (accumulator + 1e-9 >= 1) {
        const split = splitActions(queue, state);
        queue = split.deferred;
        const result = stepBoss(state, { actions: split.ready, playerHp });
        state = result.state;
        events.push(...result.events);
        accumulator -= 1;
      }
      if (Math.abs(accumulator) < 1e-9) accumulator = 0;
      return Object.freeze({ events: Object.freeze(events), state });
    }
  });
}
