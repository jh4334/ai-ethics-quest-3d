import { PLAYER_RULES } from '../content/actions.js';
import {
  acceptCommittedInput, advanceAction, cancelAction, idleAction
} from '../combat/actionMachine.js';
import {
  pruneContacts, resolveBlade, resolveIncoming, resolveInvestigation
} from '../combat/contacts.js';
import { normalizeDirection, quantize } from '../combat/geometry.js';

const ACTION_INPUTS = new Set(['attack', 'dash', 'reflect', 'trace', 'secure']);

function cloneState(state) {
  return {
    ...state,
    chain: { ...state.chain },
    targets: state.targets.map((target) => ({ ...target, position: { ...target.position } })),
    transient: { processedContacts: state.transient.processedContacts.map((entry) => ({ ...entry })) },
    player: {
      ...state.player,
      position: { ...state.player.position },
      facing: { ...state.player.facing },
      action: { ...state.player.action, hitTargets: [...state.player.action.hitTargets] },
      buffer: state.player.buffer ? { ...state.player.buffer, command: { ...state.player.buffer.command } } : null,
      combo: { ...state.player.combo },
      cooldowns: { ...state.player.cooldowns }
    }
  };
}

export function createCombatState({ targets = [], hp = PLAYER_RULES.maxHp } = {}) {
  return {
    version: 1,
    tick: 0,
    paused: false,
    chain: { points: 0, level: 0 },
    targets: targets.map((entry) => ({
      id: entry.id,
      position: { x: entry.position?.x ?? 0, y: entry.position?.y ?? 0 },
      hp: entry.hp ?? 100,
      staggerTicks: 0,
      defeated: false,
      traced: false,
      secured: false
    })),
    transient: { processedContacts: [] },
    player: {
      hp: Math.max(0, Math.min(PLAYER_RULES.maxHp, hp)),
      status: hp <= 0 ? 'defeated' : 'active',
      position: { x: 0, y: 0 },
      facing: { x: 1, y: 0 },
      action: hp <= 0
        ? { name: 'defeat', instanceId: 1, elapsed: 0, hitTargets: [], targetId: null }
        : idleAction(),
      nextActionId: hp <= 0 ? 1 : 0,
      buffer: null,
      combo: { nextIndex: 0, expiresTick: -1 },
      cooldowns: { dash: 0, reflect: 0, trace: 0, secure: 0 }
    }
  };
}

function reject(events, reason, tick) {
  events.push({ type: 'input-rejected', reason, tick });
}

function applyMovement(state, command) {
  if (state.player.status !== 'active') return;
  const direction = normalizeDirection(command.x, command.y, state.player.facing);
  if (!Number.isFinite(command.x) || !Number.isFinite(command.y) || (command.x === 0 && command.y === 0)) return;
  state.player.facing = direction;
  state.player.position.x = quantize(state.player.position.x + direction.x * PLAYER_RULES.movePerTick);
  state.player.position.y = quantize(state.player.position.y + direction.y * PLAYER_RULES.movePerTick);
}

function applyDashMotion(state) {
  const action = state.player.action;
  if (action.name !== 'dash') return;
  const definition = action.elapsed >= 1 && action.elapsed < 7 ? PLAYER_RULES.movePerTick * 3.8 : 0;
  state.player.position.x = quantize(state.player.position.x + state.player.facing.x * definition);
  state.player.position.y = quantize(state.player.position.y + state.player.facing.y * definition);
}

function processCommands(state, commands, events) {
  for (const command of commands) {
    if (!command || typeof command.type !== 'string') {
      reject(events, 'malformed', state.tick);
      continue;
    }
    if (command.type === 'move') {
      applyMovement(state, command);
    } else if (command.type === 'incoming') {
      if (!resolveIncoming(state, command, events)) reject(events, 'malformed-contact', state.tick);
    } else if (command.type === 'cancel') {
      cancelAction(state.player, state.tick, events);
    } else if (ACTION_INPUTS.has(command.type)) {
      if (state.player.status === 'active') acceptCommittedInput(state.player, command, state.tick, events);
    } else {
      reject(events, 'unknown', state.tick);
    }
  }
}

export function stepCombat(currentState, commands = []) {
  const state = cloneState(currentState);
  const events = [];
  const safeCommands = Array.isArray(commands) ? commands : [];
  if (state.paused) {
    if (safeCommands.some((command) => command?.type === 'resume')) {
      state.paused = false;
      events.push({ type: 'resumed', tick: state.tick });
    }
    return { state, events };
  }
  if (safeCommands.some((command) => command?.type === 'pause')) {
    state.paused = true;
    events.push({ type: 'paused', tick: state.tick });
    return { state, events };
  }
  for (const name of Object.keys(state.player.cooldowns)) {
    state.player.cooldowns[name] = Math.max(0, state.player.cooldowns[name] - 1);
  }
  for (const target of state.targets) target.staggerTicks = Math.max(0, target.staggerTicks - 1);
  if (state.player.buffer && state.player.buffer.expiresTick < state.tick) state.player.buffer = null;
  pruneContacts(state);
  processCommands(state, safeCommands.filter((command) => !['pause', 'resume'].includes(command?.type)), events);
  applyDashMotion(state);
  resolveBlade(state, events);
  resolveInvestigation(state, events);
  advanceAction(state.player, state.tick, events);
  state.tick += 1;
  return { state, events };
}
