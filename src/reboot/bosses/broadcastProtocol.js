import { deepFreeze, normalizeRebootState } from '../state/model.js';

const PHASES = [
  { id: 'reflect-shield', response: 'reflect', targetId: null },
  { id: 'trace-consent', response: 'trace', targetId: 'consent-ledger' },
  { id: 'dash-relay', response: 'dash', targetId: null },
  { id: 'signal-core', response: 'attack', targetId: null }
].map((phase) => ({
  ...phase,
  damage: 50,
  timing: { activeTicks: 20, recoveryTicks: 8, windupTicks: 18 }
}));

export const BROADCAST_PROTOCOL = deepFreeze({
  id: 'lumen-dot-protection-protocol',
  maxHp: 200,
  protectors: ['lumen', 'dot'],
  phases: PHASES
});

function supportProtected(campaign) {
  return campaign.evidence.some((record) => (
    record.evidenceId === 'support-record' && record.action === 'secure'
  ));
}

function freezeState(state) {
  return deepFreeze({ ...state, processedActionIds: [...state.processedActionIds] });
}

function result(state, events) {
  return Object.freeze({ events: deepFreeze(events), state: freezeState(state) });
}

export function createBroadcastProtocolState(seed) {
  const campaign = normalizeRebootState(seed);
  const prepared = supportProtected(campaign);
  return freezeState({
    activeWindowTicks: prepared ? 720 : 600,
    definition: BROADCAST_PROTOCOL,
    hp: BROADCAST_PROTOCOL.maxHp,
    phaseIndex: 0,
    phaseTick: 0,
    prepared,
    processedActionIds: [],
    status: 'active',
    tick: 0,
    version: 1
  });
}

function accepts(phase, action) {
  return action.type === phase.response
    && (phase.targetId === null || action.targetId === phase.targetId);
}

function freshActions(state, actions) {
  const seen = new Set(state.processedActionIds);
  return (Array.isArray(actions) ? actions : []).filter((action) => {
    if (!action || typeof action.id !== 'string' || seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

export function stepBroadcastProtocol(state, context = {}) {
  if (state?.version !== 1 || state.definition !== BROADCAST_PROTOCOL) {
    throw new TypeError('유효한 방송 보호 프로토콜 상태가 필요합니다.');
  }
  if (state.status === 'victory') return result(state, []);
  if (context.playerHp !== undefined && !(context.playerHp > 0)) {
    return result({ ...state, status: 'defeated', tick: state.tick + 1 }, [{ type: 'protocol-attempt-lost' }]);
  }
  if (state.status === 'defeated') {
    return result(createBroadcastProtocolState({
      schemaVersion: 4,
      integrity: { secured: state.prepared ? 1 : 0, lost: 0 },
      exposure: { contained: 0, disclosed: 0 },
      trust: { dot: 0, haru: 0, lumen: 0, yoonseo: 0 },
      chapterProgress: { completed: [], current: 1, checkpoint: 'chapter-1:start' },
      patchChoice: null,
      evidence: state.prepared ? [{ action: 'secure', chapter: 4, evidenceId: 'support-record' }] : [],
      settings: { motion: 'full', quality: 'auto', sound: true }
    }), [{ type: 'protocol-retry-ready' }]);
  }

  const phase = state.definition.phases[state.phaseIndex];
  const actions = freshActions(state, context.actions);
  const processedActionIds = [
    ...state.processedActionIds,
    ...actions.map((action) => action.id)
  ].slice(-64);
  const active = state.phaseTick >= phase.timing.windupTicks
    && state.phaseTick < phase.timing.windupTicks + state.activeWindowTicks;
  const accepted = actions.find((action) => active && accepts(phase, action));
  const events = [];
  if (state.phaseTick === 0) {
    events.push({
      activeWindowTicks: state.activeWindowTicks,
      phaseId: phase.id,
      response: phase.response,
      targetId: phase.targetId,
      type: 'protocol-telegraph'
    });
  }
  for (const action of actions) {
    if (action !== accepted) events.push({ action: action.type, phaseId: phase.id, type: 'protocol-rejected' });
  }
  if (accepted) {
    const hp = Math.max(0, state.hp - phase.damage);
    const final = state.phaseIndex === state.definition.phases.length - 1;
    events.push({ action: accepted.type, phaseId: phase.id, type: 'protocol-mastered' });
    if (final) events.push({ type: 'broadcast-console-unlocked' });
    return result({
      ...state,
      hp,
      phaseIndex: final ? state.phaseIndex : state.phaseIndex + 1,
      phaseTick: 0,
      processedActionIds,
      status: final ? 'victory' : 'active',
      tick: state.tick + 1
    }, events);
  }

  const nextPhaseTick = state.phaseTick + 1;
  const expired = nextPhaseTick >= phase.timing.windupTicks + state.activeWindowTicks + phase.timing.recoveryTicks;
  if (expired) events.push({ phaseId: phase.id, type: 'protocol-window-reset' });
  return result({
    ...state,
    phaseTick: expired ? 0 : nextPhaseTick,
    processedActionIds,
    tick: state.tick + 1
  }, events);
}
