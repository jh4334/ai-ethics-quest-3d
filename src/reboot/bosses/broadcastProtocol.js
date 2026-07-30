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

// LUMEN 압박 펄스(S3c) — 난수 없는 저작 스케줄. 각 단계에서 phaseTick이 40의 배수가 되는
// 순간 윈드업이 시작되고, 30틱 안에 K(반사)로 무효화하지 못하면 명중한다(HP -12).
// HP 0은 사망이 아니라 현재 단계만 리셋한다(무처벌 원칙 — 진행한 단계는 유지).
export const PULSE_RULES = deepFreeze({
  blockSignalGain: 10,
  damage: 12,
  maxPlayerHp: 100,
  maxPlayerSignal: 100,
  periodTicks: 40,
  startSignal: 50,
  windupTicks: 30
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
    playerHp: PULSE_RULES.maxPlayerHp,
    playerSignal: PULSE_RULES.startSignal,
    prepared,
    processedActionIds: [],
    pulseWindupRemaining: null,
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
  // 키 우선순위(S3c) — 윈드업 중의 K(반사)는 단계 키와 겹쳐도(reflect-shield) 항상
  // 펄스 방어로 먼저 소비된다. 윈드업이 없을 때의 K는 기존대로 단계 진행 후보다.
  const blocker = state.pulseWindupRemaining !== null
    ? actions.find((action) => action.type === 'reflect')
    : undefined;
  const active = state.phaseTick >= phase.timing.windupTicks
    && state.phaseTick < phase.timing.windupTicks + state.activeWindowTicks;
  const accepted = actions.find((action) => action !== blocker && active && accepts(phase, action));
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
  let playerSignal = state.playerSignal;
  let pulseWindupRemaining = state.pulseWindupRemaining;
  if (blocker) {
    // 반사 무효화 — 펄스가 사라지고 SIGNAL 보상이 쌓인다(다음 펄스는 다음 40틱 배수에서).
    playerSignal = Math.min(PULSE_RULES.maxPlayerSignal, playerSignal + PULSE_RULES.blockSignalGain);
    pulseWindupRemaining = null;
    events.push({ phaseId: phase.id, signalGain: PULSE_RULES.blockSignalGain, type: 'lumen-pulse-blocked' });
  }
  for (const action of actions) {
    if (action !== accepted && action !== blocker) {
      events.push({ action: action.type, phaseId: phase.id, type: 'protocol-rejected' });
    }
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
      playerSignal,
      processedActionIds,
      pulseWindupRemaining: null, // 단계가 넘어가면 대기 중 펄스는 함께 해소된다.
      status: final ? 'victory' : 'active',
      tick: state.tick + 1
    }, events);
  }

  const nextPhaseTick = state.phaseTick + 1;
  const expired = nextPhaseTick >= phase.timing.windupTicks + state.activeWindowTicks + phase.timing.recoveryTicks;
  if (expired) events.push({ phaseId: phase.id, type: 'protocol-window-reset' });
  let playerHp = state.playerHp;
  if (expired) {
    pulseWindupRemaining = null; // 창 리셋 — phaseTick 기준 스케줄이므로 대기 펄스도 함께 접는다.
  } else if (pulseWindupRemaining === null) {
    if (nextPhaseTick % PULSE_RULES.periodTicks === 0) {
      pulseWindupRemaining = PULSE_RULES.windupTicks;
      events.push({ phaseId: phase.id, type: 'lumen-pulse-windup', windupTicks: PULSE_RULES.windupTicks });
    }
  } else {
    pulseWindupRemaining -= 1;
    if (pulseWindupRemaining <= 0) {
      pulseWindupRemaining = null;
      playerHp = Math.max(0, playerHp - PULSE_RULES.damage);
      events.push({ damage: PULSE_RULES.damage, phaseId: phase.id, type: 'lumen-pulse-hit' });
      if (playerHp === 0) {
        // 무처벌 — 사망 대신 현재 단계만 처음부터. 진행한 단계·SIGNAL은 그대로 유지된다.
        events.push({ phaseId: phase.id, type: 'phase-reset' });
        return result({
          ...state,
          phaseTick: 0,
          playerHp: PULSE_RULES.maxPlayerHp,
          playerSignal,
          processedActionIds,
          pulseWindupRemaining: null,
          tick: state.tick + 1
        }, events);
      }
    }
  }
  return result({
    ...state,
    phaseTick: expired ? 0 : nextPhaseTick,
    playerHp,
    playerSignal,
    processedActionIds,
    pulseWindupRemaining,
    tick: state.tick + 1
  }, events);
}
