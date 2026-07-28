import { ENEMY_DEFINITIONS } from '../content/enemies/catalog.js';
import { createEnemyInstance, resetEnemyInstance, stepEnemy } from '../enemies/runtime.js';

function freezeEncounter(value) {
  return Object.freeze({
    ...value,
    enemies: Object.freeze([...value.enemies])
  });
}

export function attackerCapFor(deviceClass) {
  return deviceClass === 'mobile' || deviceClass === 'touch' ? 2 : 3;
}

export function getCommittedAttackerIds(encounter) {
  return Object.freeze(encounter.enemies
    .filter((enemy) => enemy.phase === 'windup' || enemy.phase === 'active')
    .map((enemy) => enemy.id));
}

export function createEncounter(definition, options = {}) {
  const enemies = definition.spawns.map((spawn) => {
    const enemyDefinition = ENEMY_DEFINITIONS[spawn.definitionId];
    if (!enemyDefinition) throw new Error(`알 수 없는 적 정의: ${spawn.definitionId}`);
    return createEnemyInstance(enemyDefinition, spawn);
  });
  return freezeEncounter({
    definition,
    deviceClass: options.deviceClass === 'mobile' || options.deviceClass === 'touch' ? options.deviceClass : 'desktop',
    enemies,
    tick: 0
  });
}

export function resetEncounter(encounter) {
  return freezeEncounter({
    ...encounter,
    enemies: encounter.enemies.map(resetEnemyInstance),
    tick: 0
  });
}

export function stepEncounter(encounter, context) {
  const cap = attackerCapFor(encounter.deviceClass);
  const committed = new Set(getCommittedAttackerIds(encounter));
  const events = [];
  const feedback = [];
  const enemies = [];
  for (const enemy of encounter.enemies) {
    const targetedEffects = [...(context.effects ?? []), ...(context.contacts ?? [])]
      .filter((effect) => effect.targetId === undefined || effect.targetId === enemy.id);
    const canCommit = committed.has(enemy.id) || committed.size < cap;
    const result = stepEnemy(enemy, { ...context, canCommit, effects: targetedEffects });
    enemies.push(result.state);
    events.push(...result.events);
    feedback.push(...result.feedback);
    const nowCommitted = result.state.phase === 'windup' || result.state.phase === 'active';
    if (nowCommitted) committed.add(enemy.id);
    else committed.delete(enemy.id);
  }
  const state = freezeEncounter({ ...encounter, enemies, tick: encounter.tick + 1 });
  return Object.freeze({
    events: Object.freeze(events),
    feedback: Object.freeze(feedback),
    state
  });
}
