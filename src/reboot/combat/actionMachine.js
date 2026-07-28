import { ACTIONS, PLAYER_RULES } from '../content/actions.js';

const COMBO_ACTIONS = Object.freeze(['attack1', 'attack2', 'attack3']);

export function idleAction() {
  return { name: 'idle', instanceId: 0, elapsed: 0, hitTargets: [], targetId: null };
}

export function actionPhase(actionState) {
  if (actionState.name === 'idle') return 'idle';
  const definition = ACTIONS[actionState.name];
  if (actionState.elapsed < definition.startupTicks) return 'startup';
  if (actionState.elapsed < definition.startupTicks + definition.activeTicks) return 'active';
  return 'recovery';
}

export function remainingTicks(actionState) {
  if (actionState.name === 'idle') return 0;
  return ACTIONS[actionState.name].totalTicks - actionState.elapsed;
}

function requestedAction(player, commandType, tick) {
  if (commandType !== 'attack') return commandType;
  if (player.combo.expiresTick < tick) return 'attack1';
  return COMBO_ACTIONS[player.combo.nextIndex] ?? 'attack1';
}

function cooldownReady(player, name) {
  return !Object.hasOwn(player.cooldowns, name) || player.cooldowns[name] <= 0;
}

export function canStartAction(player, commandType, tick) {
  const name = requestedAction(player, commandType, tick);
  if (!Object.hasOwn(ACTIONS, name) || ['stagger', 'defeat'].includes(name)) return false;
  return player.action.name === 'idle' && cooldownReady(player, name);
}

export function startAction(player, command, tick, events) {
  const name = requestedAction(player, command.type, tick);
  if (!canStartAction(player, command.type, tick)) return false;
  player.nextActionId += 1;
  player.action = {
    name, instanceId: player.nextActionId, elapsed: 0, hitTargets: [],
    targetId: typeof command.targetId === 'string' ? command.targetId : null
  };
  player.buffer = null;
  if (Object.hasOwn(player.cooldowns, name)) player.cooldowns[name] = ACTIONS[name].cooldownTicks;
  events.push({ type: 'action-started', action: name, instanceId: player.nextActionId, tick });
  return true;
}

export function forcePlayerAction(player, name, tick, events) {
  const previous = player.action;
  if (previous.name !== 'idle') {
    events.push({
      type: 'action-cancelled', action: previous.name,
      instanceId: previous.instanceId, reason: name, tick
    });
  }
  player.nextActionId += 1;
  player.action = {
    name, instanceId: player.nextActionId, elapsed: 0, hitTargets: [], targetId: null
  };
  player.buffer = null;
  events.push({ type: 'action-started', action: name, instanceId: player.nextActionId, tick });
}

export function acceptCommittedInput(player, command, tick, events) {
  const action = player.action;
  if (action.name === 'idle') return startAction(player, command, tick, events);
  const definition = ACTIONS[action.name];
  const phase = actionPhase(action);
  if (phase === 'recovery' && definition.cancelInto.includes(command.type)) {
    events.push({
      type: 'action-cancelled', action: action.name,
      instanceId: action.instanceId, reason: command.type, tick
    });
    player.action = idleAction();
    return startAction(player, command, tick, events);
  }
  if (remainingTicks(action) <= definition.bufferTicks && player.buffer === null) {
    player.buffer = { command: { type: command.type, targetId: command.targetId }, expiresTick: tick + PLAYER_RULES.inputBufferTicks };
    events.push({ type: 'input-buffered', action: command.type, tick });
  }
  return false;
}

export function cancelAction(player, tick, events) {
  const action = player.action;
  if (action.name === 'idle' || !ACTIONS[action.name].cancelInto.includes('cancel')) return false;
  events.push({ type: 'action-cancelled', action: action.name, instanceId: action.instanceId, reason: 'cancel', tick });
  player.action = idleAction();
  player.buffer = null;
  return true;
}

export function advanceAction(player, tick, events) {
  const action = player.action;
  if (action.name === 'idle' || action.name === 'defeat') return;
  action.elapsed += 1;
  if (action.elapsed < ACTIONS[action.name].totalTicks) return;
  events.push({ type: 'action-completed', action: action.name, instanceId: action.instanceId, tick });
  if (COMBO_ACTIONS.includes(action.name)) {
    const index = COMBO_ACTIONS.indexOf(action.name);
    player.combo = { nextIndex: (index + 1) % COMBO_ACTIONS.length, expiresTick: tick + PLAYER_RULES.comboGraceTicks };
  }
  player.action = idleAction();
  const buffered = player.buffer;
  player.buffer = null;
  if (buffered && buffered.expiresTick >= tick) startAction(player, buffered.command, tick, events);
}
