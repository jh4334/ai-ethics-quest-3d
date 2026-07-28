import { resolveEnemyContacts } from './contact.js';
import { createEnemyFeedback } from './feedback.js';
import { decideEnemyIntent } from './intent.js';
import { applyEnemyMotion } from './motion.js';
import { perceiveEnemy } from './perception.js';
import { freezeEnemyState, freezeEvents } from './state.js';

export function createEnemyInstance(definition, spawn) {
  const position = { x: spawn.position.x, z: spawn.position.z };
  return freezeEnemyState({
    armor: definition.armor.hits,
    cooldownTicks: 0,
    definition,
    faceTicks: 0,
    facing: Number.isFinite(spawn.facing) ? spawn.facing : 0,
    hp: definition.stats.maxHp,
    id: spawn.id,
    lastIntent: 'idle',
    phase: 'idle',
    phaseDuration: 0,
    phaseTick: 0,
    position,
    processedContacts: [],
    rewardGranted: false,
    spawn: { facing: Number.isFinite(spawn.facing) ? spawn.facing : 0, position, zoneId: spawn.zoneId },
    targetId: null,
    zoneId: spawn.zoneId
  });
}
export function resetEnemyInstance(enemy) {
  return createEnemyInstance(enemy.definition, {
    facing: enemy.spawn.facing,
    id: enemy.id,
    position: enemy.spawn.position,
    zoneId: enemy.spawn.zoneId
  });
}

function transitionEvents(before, after, intent) {
  const events = [];
  if (intent.type === 'acquire') events.push({ enemyId: after.id, targetId: after.targetId, type: 'target-acquired' });
  if (intent.type === 'lose-target') events.push({ enemyId: after.id, type: 'target-lost' });
  if (intent.type === 'commit-attack') {
    events.push({ enemyId: after.id, moveId: after.definition.moves[0].id, type: 'attack-committed' });
  }
  if (intent.type === 'cancel-attack') events.push({ enemyId: after.id, type: 'attack-cancelled' });
  if (before.phase === 'windup' && after.phase === 'active') {
    const move = after.definition.moves[0];
    events.push({
      damage: move.damage,
      enemyId: after.id,
      kind: move.kind,
      moveId: move.id,
      projectile: move.projectile ?? null,
      type: 'attack-contact'
    });
  }
  if (before.phase === 'recover' && after.phase === 'idle') {
    events.push({ enemyId: after.id, type: 'attack-recovered' });
  }
  return events;
}

export function stepEnemy(enemy, context) {
  const contacted = resolveEnemyContacts(enemy, context.effects ?? []);
  const contactEvents = [...contacted.events];
  if (contacted.state.phase === 'defeat' || contactEvents.some((event) => event.type === 'attack-interrupted'
    || event.type === 'enemy-interrupted' || event.type === 'enemy-staggered')) {
    const events = freezeEvents(contactEvents);
    return Object.freeze({ events, feedback: createEnemyFeedback(events, enemy.definition), state: contacted.state });
  }
  const perception = perceiveEnemy(contacted.state, context);
  const intent = decideEnemyIntent(contacted.state, perception, { canCommit: context.canCommit });
  const state = applyEnemyMotion(contacted.state, intent);
  const events = freezeEvents([...contactEvents, ...transitionEvents(contacted.state, state, intent)]);
  const feedback = createEnemyFeedback(events, enemy.definition);
  return Object.freeze({ events, feedback, intent, perception, state });
}
