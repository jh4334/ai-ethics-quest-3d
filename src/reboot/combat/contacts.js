import { ACTIONS, PLAYER_RULES } from '../content/actions.js';
import { actionPhase, forcePlayerAction } from './actionMachine.js';
import { isContactInArc } from './geometry.js';

function raiseChain(state, points, reason, events) {
  const previous = state.chain.level;
  state.chain.points = Math.min(
    state.chain.points + points,
    PLAYER_RULES.chainThresholds.at(-1)
  );
  state.chain.level = PLAYER_RULES.chainThresholds.filter((threshold) => state.chain.points >= threshold).length;
  if (state.chain.level > previous) events.push({ type: 'chain-raised', level: state.chain.level, reason, tick: state.tick });
}

// 시그널 회복 — 정수 덧셈 후 상한(maxSignal)에서 자른다.
function gainSignal(player, amount) {
  player.signal = Math.min(PLAYER_RULES.maxSignal, player.signal + amount);
}

function rememberContact(state, contactId) {
  const known = state.transient.processedContacts.some((entry) => entry.id === contactId);
  if (known) return false;
  state.transient.processedContacts.push({
    id: contactId,
    expiresTick: state.tick + PLAYER_RULES.contactMemoryTicks
  });
  if (state.transient.processedContacts.length > PLAYER_RULES.maxContactMemory) {
    state.transient.processedContacts.splice(0, state.transient.processedContacts.length - PLAYER_RULES.maxContactMemory);
  }
  return true;
}

export function pruneContacts(state) {
  state.transient.processedContacts = state.transient.processedContacts.filter((entry) => entry.expiresTick >= state.tick);
}

export function resolveIncoming(state, contact, events) {
  if (typeof contact.contactId !== 'string' || typeof contact.sourceId !== 'string') return false;
  if (!rememberContact(state, contact.contactId)) return true;
  const player = state.player;
  const action = player.action;
  const phase = actionPhase(action);
  if (action.name === 'dash' && phase === 'active') {
    events.push({ type: 'evaded', contactId: contact.contactId, tick: state.tick });
    return true;
  }
  const reflect = ACTIONS.reflect;
  const reflectable = action.name === 'reflect'
    && phase === 'active'
    && isContactInArc(player.position, player.facing, contact.position, reflect.range, reflect.facingDot);
  if (reflectable) {
    const perfect = action.elapsed >= reflect.perfectStart && action.elapsed <= reflect.perfectEnd;
    const type = perfect ? 'perfect-reflect' : 'reflected';
    events.push({
      type, contactId: contact.contactId, sourceId: contact.sourceId,
      hitId: `${action.instanceId}:${contact.sourceId}:${contact.contactId}`, tick: state.tick
    });
    raiseChain(state, perfect ? 2 : 1, type, events);
    if (perfect) gainSignal(player, PLAYER_RULES.signalPerfectReflectGain);
    return true;
  }
  const damage = Number.isFinite(contact.damage) ? Math.max(0, contact.damage) : 0;
  player.hp = Math.max(0, player.hp - damage);
  state.chain = { points: 0, level: 0 };
  events.push({ type: 'player-hit', contactId: contact.contactId, damage, hp: player.hp, tick: state.tick });
  if (player.hp === 0) {
    player.status = 'defeated';
    forcePlayerAction(player, 'defeat', state.tick, events);
    events.push({ type: 'player-defeated', tick: state.tick });
  } else {
    forcePlayerAction(player, 'stagger', state.tick, events);
  }
  return true;
}

export function resolveBlade(state, events) {
  const action = state.player.action;
  if (!action.name.startsWith('attack') || actionPhase(action) !== 'active') return;
  const definition = ACTIONS[action.name];
  for (const target of state.targets) {
    if (target.defeated || action.hitTargets.includes(target.id)) continue;
    if (!isContactInArc(state.player.position, state.player.facing, target.position, definition.range, definition.facingDot)) continue;
    action.hitTargets.push(target.id);
    target.hp = Math.max(0, target.hp - definition.damage);
    target.staggerTicks = Math.max(target.staggerTicks, definition.stagger);
    target.defeated = target.hp === 0;
    const hitId = `${action.instanceId}:${target.id}`;
    events.push({ type: 'target-hit', targetId: target.id, hitId, damage: definition.damage, hp: target.hp, tick: state.tick });
    if (target.defeated) events.push({ type: 'target-defeated', targetId: target.id, tick: state.tick });
    raiseChain(state, 1, 'target-hit', events);
    gainSignal(state.player, PLAYER_RULES.signalHitGain);
  }
}

export function resolveInvestigation(state, events) {
  const action = state.player.action;
  if (!['trace', 'secure'].includes(action.name) || actionPhase(action) !== 'active' || action.hitTargets.length > 0) return;
  action.hitTargets.push(action.targetId ?? 'missing');
  const target = state.targets.find((entry) => entry.id === action.targetId);
  const definition = ACTIONS[action.name];
  if (!target || target.defeated || !isContactInArc(state.player.position, state.player.facing, target.position, definition.range, definition.facingDot)) {
    events.push({ type: 'action-missed', action: action.name, targetId: action.targetId, tick: state.tick });
    return;
  }
  if (action.name === 'trace') {
    target.traced = true;
    events.push({ type: 'traced', targetId: target.id, tick: state.tick });
    raiseChain(state, 1, 'traced', events);
    return;
  }
  if (!target.traced || target.secured) {
    events.push({ type: 'action-missed', action: 'secure', targetId: target.id, tick: state.tick });
    return;
  }
  target.secured = true;
  events.push({ type: 'secured', targetId: target.id, tick: state.tick });
  raiseChain(state, 2, 'secured', events);
}
