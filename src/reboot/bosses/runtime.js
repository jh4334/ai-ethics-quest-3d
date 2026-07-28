import { ATTENDANCE_PROCTOR } from '../content/bosses/attendanceProctor.js';
import { validateBossDefinition } from '../content/bosses/validateBoss.js';
import { freezeBossEvents, freezeBossState, patchBossState } from './state.js';

const MAX_PROCESSED_ACTIONS = 64;

function phaseOf(state) {
  return state.definition.phases[state.phaseIndex];
}

function patternOf(state, phase = phaseOf(state)) {
  return phase.patterns[state.cycleIndex % phase.patterns.length];
}

function appendKnowledge(knowledge, phaseId) {
  return knowledge.includes(phaseId) ? knowledge : [...knowledge, phaseId];
}

function result(state, events) {
  return Object.freeze({ events: freezeBossEvents(events), state: freezeBossState(state) });
}

export function createBossState(definition = ATTENDANCE_PROCTOR, options = {}) {
  const validation = validateBossDefinition(definition);
  if (!validation.valid) throw new TypeError('유효한 출석 감독관 정의가 필요합니다.');
  const phaseIndex = Number.isInteger(options.phaseIndex) ? options.phaseIndex : 0;
  return freezeBossState({
    consequencePath: options.consequencePath === 'purge' ? 'purge' : 'secure',
    cycleIndex: options.cycleIndex ?? 0,
    definition,
    hp: options.hp ?? definition.maxHp,
    introSeen: options.introSeen === true,
    knowledge: options.knowledge ?? [],
    phaseIndex,
    phaseSuccesses: options.phaseSuccesses ?? 0,
    phaseTick: options.phaseTick ?? 0,
    processedActionIds: options.processedActionIds ?? [],
    retries: options.retries ?? 0,
    retryTicks: options.retryTicks ?? 0,
    staggerTicks: options.staggerTicks ?? 0,
    status: options.status ?? 'active',
    tick: options.tick ?? 0
  });
}

export function resetBossState(state) {
  return createBossState(state.definition, {
    consequencePath: state.consequencePath,
    introSeen: true,
    knowledge: state.knowledge,
    retries: state.retries + 1
  });
}

function uniqueActions(state, actions) {
  const seen = new Set(state.processedActionIds);
  return (Array.isArray(actions) ? actions : []).filter((action) => {
    if (!action || typeof action.id !== 'string' || seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

function actionMatches(phase, pattern, action) {
  if (action.type !== phase.response) return false;
  if (phase.id === 'trace-roster') return action.targetId === pattern.trueTargetId;
  if (phase.id === 'approval-core') return action.targetId === 'approval-core';
  return true;
}

function telegraphEvent(phase, pattern) {
  const common = { patternId: pattern.id, phaseId: phase.id, response: phase.response, type: 'boss-telegraph' };
  if (phase.id === 'reflect-scan') {
    return { ...common, avoidable: true, beamLane: pattern.beamLane, safeLane: pattern.safeLane };
  }
  if (phase.id === 'trace-roster') return { ...common, targetIds: pattern.targetIds };
  return { ...common, erasedSectors: pattern.erasedSectors, safeSectors: pattern.safeSectors };
}

function successState(state, phase, action) {
  const phaseSuccesses = state.phaseSuccesses + 1;
  const processedActionIds = [...state.processedActionIds, action.id].slice(-MAX_PROCESSED_ACTIONS);
  const common = {
    hp: Math.max(0, state.hp - phase.damagePerSuccess),
    knowledge: appendKnowledge(state.knowledge, phase.id),
    processedActionIds,
    tick: state.tick + 1
  };
  if (phaseSuccesses < phase.requiredSuccesses) {
    return patchBossState(state, {
      ...common,
      cycleIndex: state.cycleIndex + 1,
      phaseSuccesses,
      phaseTick: 0
    });
  }
  if (state.phaseIndex < state.definition.phases.length - 1) {
    return patchBossState(state, {
      ...common,
      cycleIndex: 0,
      phaseIndex: state.phaseIndex + 1,
      phaseSuccesses: 0,
      phaseTick: 0
    });
  }
  return patchBossState(state, { ...common, hp: 0, phaseSuccesses, status: 'victory' });
}

function retryStep(state) {
  if (state.retryTicks > 1) {
    return result(patchBossState(state, { retryTicks: state.retryTicks - 1, tick: state.tick + 1 }), []);
  }
  return result(resetBossState(state), [{ retries: state.retries + 1, type: 'boss-retry-ready' }]);
}

export function stepBoss(state, context = {}) {
  if (state.status === 'victory') return result(state, []);
  if (state.status === 'defeated') return retryStep(state);
  if (!(context.playerHp > 0) && context.playerHp !== undefined) {
    const defeated = patchBossState(state, {
      retryTicks: state.definition.retryTicks,
      status: 'defeated',
      tick: state.tick + 1
    });
    return result(defeated, [{ retryTicks: state.definition.retryTicks, type: 'boss-attempt-lost' }]);
  }
  if (state.staggerTicks > 0) {
    const staggerTicks = state.staggerTicks - 1;
    const events = staggerTicks === 0 ? [{ type: 'boss-stagger-ended' }] : [];
    return result(patchBossState(state, { staggerTicks, tick: state.tick + 1 }), events);
  }

  const phase = phaseOf(state);
  const pattern = patternOf(state, phase);
  const events = [];
  if (state.phaseTick === 0) events.push(telegraphEvent(phase, pattern));
  const windowStart = phase.timing.windupTicks;
  const windowEnd = windowStart + phase.timing.activeTicks;
  const windowActive = state.phaseTick >= windowStart && state.phaseTick < windowEnd;
  if (state.phaseTick === windowStart) {
    if (phase.id === 'approval-core') {
      events.push({
        collisionChanged: false,
        erasedSectors: pattern.erasedSectors,
        safeSectors: pattern.safeSectors,
        type: 'ground-erasure-visual'
      });
    } else events.push({ patternId: pattern.id, phaseId: phase.id, type: 'boss-attack-window' });
  }

  const actions = uniqueActions(state, context.actions);
  const matching = windowActive && actions.find((action) => actionMatches(phase, pattern, action));
  if (phase.id === 'trace-roster' && windowActive) {
    for (const action of actions.filter((entry) => entry.type === 'trace' && entry.targetId !== pattern.trueTargetId)) {
      events.push({ actionId: action.id, targetId: action.targetId, type: 'clone-decoy' });
    }
  }
  if (matching) {
    const next = successState(state, phase, matching);
    events.push({ actionId: matching.id, phaseId: phase.id, type: 'mastery-success' });
    events.push({ phaseId: phase.id, type: 'boss-staggered' });
    if (next.status === 'victory') {
      events.push({ type: 'boss-defeated' });
      events.push({
        callout: state.definition.consequenceCallouts[state.consequencePath],
        signature: state.definition.signature,
        type: 'signature-revealed'
      });
    } else if (next.phaseIndex !== state.phaseIndex) {
      events.push({ phaseId: phaseOf(next).id, type: 'boss-phase-changed' });
    }
    return result(next, events);
  }

  const processedActionIds = [...state.processedActionIds, ...actions.map((action) => action.id)]
    .slice(-MAX_PROCESSED_ACTIONS);
  let phaseTick = state.phaseTick + 1;
  let cycleIndex = state.cycleIndex;
  const cycleTicks = windowEnd + phase.timing.recoveryTicks;
  if (phaseTick >= cycleTicks) {
    phaseTick = 0;
    cycleIndex += 1;
    events.push({ phaseId: phase.id, type: 'boss-window-reset' });
  }
  return result(patchBossState(state, {
    cycleIndex,
    phaseTick,
    processedActionIds,
    tick: state.tick + 1
  }), events);
}
