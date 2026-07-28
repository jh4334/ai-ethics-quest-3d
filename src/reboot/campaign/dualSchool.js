import { deepFreeze } from '../state/model.js';

const LAYERS = Object.freeze(['comfort', 'verified']);

function freezeState(state) {
  return deepFreeze({ ...state, enemies: state.enemies.map((enemy) => ({ ...enemy })) });
}

function validState(state) {
  return state?.version === 1
    && Number.isInteger(state.tick)
    && state.tick >= 0
    && typeof state.paused === 'boolean'
    && LAYERS.includes(state.activeLayer)
    && Array.isArray(state.enemies)
    && state.enemies.length === 2
    && state.enemies.every((enemy) => (
      typeof enemy.id === 'string' && LAYERS.includes(enemy.layer)
      && Number.isInteger(enemy.hp) && enemy.hp >= 0 && enemy.hp <= 100
    ));
}

export function createDualSchoolState() {
  return freezeState({
    activeLayer: 'comfort',
    enemies: [
      { hp: 100, id: 'recommender-comfort', layer: 'comfort' },
      { hp: 100, id: 'recommender-verified', layer: 'verified' }
    ],
    paused: false,
    tick: 0,
    version: 1
  });
}

function event(type, tick, values = {}) {
  return Object.freeze({ tick, type, ...values });
}

export function stepDualSchool(current, command) {
  if (!validState(current) || !command || typeof command.type !== 'string') {
    throw new TypeError('두 개의 학교 상태와 명령이 필요합니다.');
  }
  const tick = current.tick + 1;
  if (current.paused && command.type !== 'resume') {
    return Object.freeze({
      event: event('command-ignored-paused', tick, { command: command.type }),
      state: freezeState({ ...current, tick })
    });
  }
  if (command.type === 'pause') {
    return Object.freeze({ event: event('paused', tick), state: freezeState({ ...current, paused: true, tick }) });
  }
  if (command.type === 'resume') {
    return Object.freeze({ event: event('resumed', tick), state: freezeState({ ...current, paused: false, tick }) });
  }
  if (command.type === 'switch-layer') {
    const activeLayer = current.activeLayer === 'comfort' ? 'verified' : 'comfort';
    return Object.freeze({
      event: event('layer-switched', tick, { activeLayer }),
      state: freezeState({ ...current, activeLayer, tick })
    });
  }
  if (command.type === 'damage-enemy') {
    const enemy = current.enemies.find((candidate) => candidate.id === command.enemyId);
    const active = enemy?.layer === current.activeLayer;
    const amount = Number.isInteger(command.amount) ? Math.max(0, command.amount) : 0;
    const enemies = active
      ? current.enemies.map((candidate) => candidate.id === enemy.id
        ? { ...candidate, hp: Math.max(0, candidate.hp - amount) }
        : candidate)
      : current.enemies;
    return Object.freeze({
      event: event(active ? 'enemy-damaged' : 'cross-layer-miss', tick, { enemyId: command.enemyId }),
      state: freezeState({ ...current, enemies, tick })
    });
  }
  return Object.freeze({
    event: event('command-ignored-unknown', tick, { command: command.type }),
    state: freezeState({ ...current, tick })
  });
}

export function replayDualSchool(initial, commands) {
  let state = restoreDualSchool(initial);
  const events = [];
  for (const command of Array.isArray(commands) ? commands : []) {
    const result = stepDualSchool(state, command);
    state = result.state;
    events.push(result.event);
  }
  return Object.freeze({ events: Object.freeze(events), state });
}

export function serializeDualSchool(state) {
  if (!validState(state)) throw new TypeError('저장할 두 개의 학교 상태가 올바르지 않습니다.');
  return JSON.stringify(state);
}

export function restoreDualSchool(value) {
  if (validState(value)) return freezeState(value);
  if (typeof value !== 'string') throw new TypeError('두 개의 학교 저장 문자열이 필요합니다.');
  const parsed = JSON.parse(value);
  if (!validState(parsed)) throw new RangeError('두 개의 학교 저장 상태가 손상됐습니다.');
  return freezeState(parsed);
}
